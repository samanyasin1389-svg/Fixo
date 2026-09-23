import type { AdbRunner } from "@fixo/mcp-network";
import { shell } from "@fixo/mcp-network";
import { checkAppInstalled, installFromPlay } from "./play.js";

export const V2BOX_PACKAGE = "dev.hexasoftware.v2box";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function dumpUi(adb: AdbRunner, serial: string) {
  const evidence: string[] = [];
  const dump = await shell(
    adb,
    serial,
    "uiautomator dump /sdcard/fixo-ui.xml >/dev/null 2>&1 && cat /sdcard/fixo-ui.xml",
    20_000,
  );
  evidence.push(dump.evidence);
  return { xml: dump.stdout, evidence };
}

function escapeXmlAttr(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findTapPoint(
  xml: string,
  labels: string[],
): { x: number; y: number; label: string } | null {
  for (const label of labels) {
    const re = new RegExp(
      `<(?:node|android\\.widget\\.\\w+)[^>]*(?:text|content-desc)="${escapeXmlAttr(label)}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
      "i",
    );
    const m = xml.match(re);
    if (m) {
      return {
        x: Math.floor((Number(m[1]) + Number(m[3])) / 2),
        y: Math.floor((Number(m[2]) + Number(m[4])) / 2),
        label,
      };
    }
    const loose = new RegExp(
      `text="${escapeXmlAttr(label)}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"|bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*text="${escapeXmlAttr(label)}"`,
      "i",
    );
    const m2 = xml.match(loose);
    if (m2) {
      const nums = m2.slice(1).filter(Boolean).map(Number);
      if (nums.length >= 4) {
        return {
          x: Math.floor((nums[0]! + nums[2]!) / 2),
          y: Math.floor((nums[1]! + nums[3]!) / 2),
          label,
        };
      }
    }
  }
  return null;
}

async function setClipboard(adb: AdbRunner, serial: string, text: string) {
  const evidence: string[] = [];
  const escaped = text.replace(/'/g, "'\\''");
  // Prefer cmd clipboard on modern Android; fall back to service call.
  const viaCmd = await shell(
    adb,
    serial,
    `cmd clipboard set-text '${escaped}'`,
    8_000,
  );
  evidence.push(viaCmd.evidence);
  if (viaCmd.code === 0 && !/error|exception|Unknown/i.test(viaCmd.stdout + viaCmd.stderr)) {
    return { ok: true, evidence };
  }

  const viaService = await shell(
    adb,
    serial,
    `service call clipboard 2 i32 1 i32 0 s16 '${escaped}'`,
    8_000,
  );
  evidence.push(viaService.evidence);
  return {
    ok: viaService.code === 0,
    evidence,
  };
}

async function openV2Box(adb: AdbRunner, serial: string) {
  const evidence: string[] = [];
  const launch = await shell(
    adb,
    serial,
    `monkey -p ${V2BOX_PACKAGE} -c android.intent.category.LAUNCHER 1`,
    10_000,
  );
  evidence.push(launch.evidence);
  if (launch.code !== 0) {
    const am = await shell(
      adb,
      serial,
      `am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER ${V2BOX_PACKAGE}`,
      10_000,
    );
    evidence.push(am.evidence);
  }
  await sleep(1800);
  return { evidence };
}

async function tryIntentImport(
  adb: AdbRunner,
  serial: string,
  subscriptionUrl: string,
) {
  const evidence: string[] = [];
  const encoded = subscriptionUrl.replace(/'/g, "'\\''");
  const attempts = [
    `am start -a android.intent.action.VIEW -d '${encoded}' -p ${V2BOX_PACKAGE}`,
    `am start -a android.intent.action.VIEW -d '${encoded}'`,
    `am start -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT '${encoded}' -p ${V2BOX_PACKAGE}`,
  ];
  for (const cmd of attempts) {
    const r = await shell(adb, serial, cmd, 10_000);
    evidence.push(r.evidence);
    if (r.code === 0 && !/error|exception|Activity not started/i.test(r.stdout + r.stderr)) {
      await sleep(1500);
      return { ok: true, evidence };
    }
  }
  return { ok: false, evidence };
}

async function tryClipboardUiImport(adb: AdbRunner, serial: string) {
  const evidence: string[] = [];
  const addLabels = [
    "Add",
    "افزودن",
    "اضافه",
    "+",
    "New profile",
    "پروفایل جدید",
    "Import",
    "وارد کردن",
  ];
  const clipLabels = [
    "Import from clipboard",
    "From clipboard",
    "Clipboard",
    "از کلیپ‌بورد",
    "از کلیپ بورد",
    "کلیپ بورد",
    "کلیپ‌بورد",
    "Paste",
    "چسباندن",
  ];

  for (let round = 0; round < 3; round++) {
    const ui = await dumpUi(adb, serial);
    evidence.push(...ui.evidence);
    const clip = findTapPoint(ui.xml, clipLabels);
    if (clip) {
      const tap = await shell(adb, serial, `input tap ${clip.x} ${clip.y}`);
      evidence.push(tap.evidence);
      await sleep(1200);
      return { ok: true, evidence, strategy: `clipboard_tap:${clip.label}` };
    }
    const add = findTapPoint(ui.xml, addLabels);
    if (add) {
      const tap = await shell(adb, serial, `input tap ${add.x} ${add.y}`);
      evidence.push(tap.evidence);
      await sleep(1000);
      continue;
    }
    await sleep(800);
  }
  return { ok: false, evidence, strategy: "clipboard_ui_miss" };
}

export type V2BoxPushResult = {
  ok: boolean;
  packageId: string;
  installed: boolean;
  strategy: string;
  message: string;
  evidence: string[];
};

export async function pushConfigToV2Box(
  adb: AdbRunner,
  serial: string,
  subscriptionUrl: string,
  options?: { ensureInstalled?: boolean },
): Promise<V2BoxPushResult> {
  const evidence: string[] = [];
  const ensureInstalled = options?.ensureInstalled !== false;
  const url = subscriptionUrl.trim();
  if (!url) {
    return {
      ok: false,
      packageId: V2BOX_PACKAGE,
      installed: false,
      strategy: "missing_url",
      message: "لینک سابسکرایب خالی است",
      evidence,
    };
  }

  let check = await checkAppInstalled(adb, serial, V2BOX_PACKAGE);
  evidence.push(...check.evidence);

  if (!check.installed && ensureInstalled) {
    const installed = await installFromPlay(adb, serial, V2BOX_PACKAGE, {
      timeoutMs: 120_000,
    });
    evidence.push(...installed.evidence);
    check = {
      installed: installed.installed,
      versionName: installed.versionName,
      evidence: [],
    };
  }

  if (!check.installed) {
    return {
      ok: false,
      packageId: V2BOX_PACKAGE,
      installed: false,
      strategy: "not_installed",
      message: "وی‌توباکس نصب نیست و نصب از پلی کامل نشد",
      evidence,
    };
  }

  const viaIntent = await tryIntentImport(adb, serial, url);
  evidence.push(...viaIntent.evidence);
  if (viaIntent.ok) {
    return {
      ok: true,
      packageId: V2BOX_PACKAGE,
      installed: true,
      strategy: "intent",
      message: "کانفیگ به وی‌توباکس ارسال شد",
      evidence,
    };
  }

  const clip = await setClipboard(adb, serial, url);
  evidence.push(...clip.evidence);
  const opened = await openV2Box(adb, serial);
  evidence.push(...opened.evidence);
  const ui = await tryClipboardUiImport(adb, serial);
  evidence.push(...ui.evidence);

  if (ui.ok) {
    return {
      ok: true,
      packageId: V2BOX_PACKAGE,
      installed: true,
      strategy: ui.strategy,
      message: "کانفیگ به وی‌توباکس ارسال شد",
      evidence,
    };
  }

  // Clipboard may still be enough if the technician taps import manually.
  return {
    ok: clip.ok,
    packageId: V2BOX_PACKAGE,
    installed: true,
    strategy: clip.ok ? "clipboard_only" : "failed",
    message: clip.ok
      ? "لینک در کلیپ‌بورد گوشی کپی شد — در وی‌توباکس از کلیپ‌بورد وارد کنید"
      : "ارسال کانفیگ به وی‌توباکس ناموفق بود",
    evidence,
  };
}
