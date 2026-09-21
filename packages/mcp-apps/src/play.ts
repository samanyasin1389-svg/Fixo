import { AdbError, type AdbRunner, shell } from "@fixo/mcp-network";
import { resolvePackageId } from "./aliases.js";

export async function checkAppInstalled(
  adb: AdbRunner,
  serial: string,
  packageId: string,
): Promise<{ installed: boolean; versionName?: string; evidence: string[] }> {
  const evidence: string[] = [];
  const listed = await shell(adb, serial, `pm path ${packageId}`);
  evidence.push(listed.evidence);
  const installed = /package:/i.test(listed.stdout) && listed.code === 0;

  let versionName: string | undefined;
  if (installed) {
    const dump = await shell(
      adb,
      serial,
      `dumpsys package ${packageId} | grep -m1 versionName`,
    );
    evidence.push(dump.evidence);
    versionName = dump.stdout.match(/versionName=([^\s]+)/)?.[1];
  }

  return { installed, versionName, evidence };
}

async function dumpUi(adb: AdbRunner, serial: string) {
  const evidence: string[] = [];
  const dump = await shell(
    adb,
    serial,
    "uiautomator dump /sdcard/fixo-ui.xml >/dev/null && cat /sdcard/fixo-ui.xml",
    20_000,
  );
  evidence.push(dump.evidence);
  return { xml: dump.stdout, evidence };
}

function findTapPoint(
  xml: string,
  labels: string[],
): { x: number; y: number; label: string } | null {
  for (const label of labels) {
    // Match node with text or content-desc containing label
    const re = new RegExp(
      `<(?:node|android\\.widget\\.\\w+)[^>]*(?:text|content-desc)="${escapeXmlAttr(label)}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
      "i",
    );
    const m = xml.match(re);
    if (m) {
      const x1 = Number(m[1]);
      const y1 = Number(m[2]);
      const x2 = Number(m[3]);
      const y2 = Number(m[4]);
      return { x: Math.floor((x1 + x2) / 2), y: Math.floor((y1 + y2) / 2), label };
    }

    // Broader: any bounds near a text= label attribute elsewhere on same tag
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

function escapeXmlAttr(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function openPlayListing(
  adb: AdbRunner,
  serial: string,
  packageIdOrName: string,
): Promise<{ packageId: string; evidence: string[] }> {
  const { packageId } = resolvePackageId(packageIdOrName);
  const evidence: string[] = [];

  const market = await shell(
    adb,
    serial,
    `am start -a android.intent.action.VIEW -d 'market://details?id=${packageId}'`,
  );
  evidence.push(market.evidence);

  if (market.code !== 0 || /error|exception/i.test(market.stdout + market.stderr)) {
    const https = await shell(
      adb,
      serial,
      `am start -a android.intent.action.VIEW -d 'https://play.google.com/store/apps/details?id=${packageId}'`,
    );
    evidence.push(https.evidence);
  }

  await sleep(2000);
  return { packageId, evidence };
}

export async function installFromPlay(
  adb: AdbRunner,
  serial: string,
  packageIdOrName: string,
  options?: { timeoutMs?: number },
): Promise<{
  packageId: string;
  installed: boolean;
  strategy: string;
  versionName?: string;
  evidence: string[];
}> {
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const evidence: string[] = [];
  const opened = await openPlayListing(adb, serial, packageIdOrName);
  const packageId = opened.packageId;
  evidence.push(...opened.evidence);

  const already = await checkAppInstalled(adb, serial, packageId);
  evidence.push(...already.evidence);
  if (already.installed) {
    return {
      packageId,
      installed: true,
      strategy: "already_installed",
      versionName: already.versionName,
      evidence,
    };
  }

  // Try UIAutomator install buttons (EN/FA) — Samsung + Xiaomi Play Store
  const labels = [
    "Install",
    "Install app",
    "Get",
    "Update",
    "نصب",
    "نصب برنامه",
    "دریافت",
    "به‌روزرسانی",
    "به روز رسانی",
  ];

  let tapped = false;
  let strategy = "open_listing_only";
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(1500);
    const ui = await dumpUi(adb, serial);
    evidence.push(...ui.evidence);
    const point = findTapPoint(ui.xml, labels);
    if (point) {
      const tap = await shell(adb, serial, `input tap ${point.x} ${point.y}`);
      evidence.push(tap.evidence);
      tapped = true;
      strategy = `uiautomator_tap:${point.label}`;
      break;
    }
  }

  if (!tapped) {
    // Best-effort keyboard/accessibility independent hint path
    evidence.push("No Install/نصب button found in UI dump; left Play listing open.");
  }

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await sleep(4000);
    const check = await checkAppInstalled(adb, serial, packageId);
    evidence.push(...check.evidence);
    if (check.installed) {
      return {
        packageId,
        installed: true,
        strategy,
        versionName: check.versionName,
        evidence,
      };
    }

    // Accept button sometimes appears after Install
    const ui = await dumpUi(adb, serial);
    evidence.push(...ui.evidence);
    const accept = findTapPoint(ui.xml, ["Accept", "OK", "تأیید", "قبول", "ادامه", "Continue"]);
    if (accept) {
      const tap = await shell(adb, serial, `input tap ${accept.x} ${accept.y}`);
      evidence.push(tap.evidence);
    }
  }

  throw new AdbError(
    `Play install did not finish for ${packageId} within ${Math.round(timeoutMs / 1000)}s. Listing was opened${tapped ? " and Install tapped" : ""}; check Play Store account/network on the phone.`,
    evidence,
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
