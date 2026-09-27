import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AdbRunner } from "@fixo/mcp-network";
import { shell } from "@fixo/mcp-network";

export const GMAIL_SIGNUP_URL =
  "https://accounts.google.com/signup/v2/webcreateaccount?flowName=GlifWebSignIn&flowEntry=SignUp&hl=fa";

export type GmailAssistInput = {
  firstName?: string;
  lastName?: string;
  /** Desired local-part only (before @gmail.com). */
  username?: string;
  /** If omitted, a strong password is generated. */
  password?: string;
  /** Save credentials note under Desktop/Fixo-Notes. Default true when any identity given. */
  saveNote?: boolean;
  /** Attempt UIAutomator fill after opening signup. Default true. */
  tryFill?: boolean;
};

export type GmailAssistResult = {
  ok: boolean;
  opened: boolean;
  strategy: string;
  emailHint: string | null;
  password: string;
  passwordGenerated: boolean;
  filled: string[];
  humanNext: string[];
  notePath?: string;
  message: string;
  evidence: string[];
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** adb `input text` — spaces as %s; strip chars that break the command. */
function adbInputText(value: string): string {
  return value
    .replace(/\\/g, "")
    .replace(/'/g, "")
    .replace(/\s+/g, "%s")
    .replace(/[&|<>$`!;]/g, "");
}

export function generateGmailPassword(length = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%";
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => set[crypto.randomInt(set.length)]!;
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = chars.length; i < length; i++) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

function escapeXmlAttr(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

/** Find EditText / editable node by resource-id fragment or nearby hint. */
function findEditable(
  xml: string,
  hints: string[],
): { x: number; y: number; hint: string } | null {
  for (const hint of hints) {
    const re = new RegExp(
      `<(?:node|android\\.widget\\.\\w+)[^>]*(?:resource-id|text|content-desc|hint)="[^"]*${escapeXmlAttr(hint)}[^"]*"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
      "i",
    );
    const m = xml.match(re);
    if (m) {
      return {
        x: Math.floor((Number(m[1]) + Number(m[3])) / 2),
        y: Math.floor((Number(m[2]) + Number(m[4])) / 2),
        hint,
      };
    }
    const loose = new RegExp(
      `bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*(?:resource-id|text|content-desc|hint)="[^"]*${escapeXmlAttr(hint)}[^"]*"`,
      "i",
    );
    const m2 = xml.match(loose);
    if (m2) {
      return {
        x: Math.floor((Number(m2[1]) + Number(m2[3])) / 2),
        y: Math.floor((Number(m2[2]) + Number(m2[4])) / 2),
        hint,
      };
    }
  }
  return null;
}

async function setClipboard(adb: AdbRunner, serial: string, text: string) {
  const evidence: string[] = [];
  const viaCmd = await shell(
    adb,
    serial,
    `cmd clipboard set-text ${shellQuote(text)}`,
    8_000,
  );
  evidence.push(viaCmd.evidence);
  if (viaCmd.code === 0 && !/error|exception|Unknown/i.test(viaCmd.stdout + viaCmd.stderr)) {
    return { ok: true, evidence };
  }
  const viaService = await shell(
    adb,
    serial,
    `service call clipboard 2 i32 1 i32 0 s16 ${shellQuote(text)}`,
    8_000,
  );
  evidence.push(viaService.evidence);
  return { ok: viaService.code === 0, evidence };
}

async function tapAndType(
  adb: AdbRunner,
  serial: string,
  point: { x: number; y: number },
  text: string,
): Promise<string[]> {
  const evidence: string[] = [];
  const tap = await shell(adb, serial, `input tap ${point.x} ${point.y}`);
  evidence.push(tap.evidence);
  await sleep(350);
  const clear = await shell(adb, serial, "input keyevent KEYCODE_MOVE_END");
  evidence.push(clear.evidence);
  // Select-all + delete is unreliable; type over is usually fine on empty fields
  const typed = adbInputText(text);
  if (typed) {
    const put = await shell(adb, serial, `input text ${shellQuote(typed)}`);
    evidence.push(put.evidence);
  }
  return evidence;
}

async function openSignupOnPhone(
  adb: AdbRunner,
  serial: string,
): Promise<{ opened: boolean; strategy: string; evidence: string[] }> {
  const evidence: string[] = [];
  const url = GMAIL_SIGNUP_URL.replace(/'/g, "%27");

  const chrome = await shell(
    adb,
    serial,
    `am start -a android.intent.action.VIEW -d ${shellQuote(url)} -p com.android.chrome`,
    10_000,
  );
  evidence.push(chrome.evidence);
  if (chrome.code === 0 && !/error|exception/i.test(chrome.stdout + chrome.stderr)) {
    return { opened: true, strategy: "chrome", evidence };
  }

  const anyBrowser = await shell(
    adb,
    serial,
    `am start -a android.intent.action.VIEW -d ${shellQuote(url)}`,
    10_000,
  );
  evidence.push(anyBrowser.evidence);
  if (
    anyBrowser.code === 0 &&
    !/error|exception/i.test(anyBrowser.stdout + anyBrowser.stderr)
  ) {
    return { opened: true, strategy: "browser", evidence };
  }

  const addAccount = await shell(
    adb,
    serial,
    "am start -a android.settings.ADD_ACCOUNT_SETTINGS",
    10_000,
  );
  evidence.push(addAccount.evidence);
  if (addAccount.code === 0) {
    return { opened: true, strategy: "add_account_settings", evidence };
  }

  return { opened: false, strategy: "failed", evidence };
}

async function tryFillSignupForm(
  adb: AdbRunner,
  serial: string,
  input: {
    firstName?: string;
    lastName?: string;
    username?: string;
    password?: string;
  },
): Promise<{ filled: string[]; evidence: string[] }> {
  const evidence: string[] = [];
  const filled: string[] = [];
  await sleep(2500);
  const ui = await dumpUi(adb, serial);
  evidence.push(...ui.evidence);
  let xml = ui.xml;

  const firstName = input.firstName?.trim();
  if (firstName) {
    const field =
      findEditable(xml, ["firstName", "first_name", "First name", "نام", "نام کوچک"]) ??
      findTapPoint(xml, ["First name", "نام", "نام کوچک"]);
    if (field) {
      evidence.push(...(await tapAndType(adb, serial, field, firstName)));
      filled.push("firstName");
      await sleep(400);
    }
  }

  const lastName = input.lastName?.trim();
  if (lastName) {
    const again = await dumpUi(adb, serial);
    evidence.push(...again.evidence);
    xml = again.xml;
    const field =
      findEditable(xml, ["lastName", "last_name", "Last name", "نام خانوادگی"]) ??
      findTapPoint(xml, ["Last name", "نام خانوادگی"]);
    if (field) {
      evidence.push(...(await tapAndType(adb, serial, field, lastName)));
      filled.push("lastName");
      await sleep(400);
    }
  }

  // Prefer Next after name step
  {
    const again = await dumpUi(adb, serial);
    evidence.push(...again.evidence);
    const next = findTapPoint(again.xml, [
      "Next",
      "بعدی",
      "ادامه",
      "Continue",
    ]);
    if (next && (filled.includes("firstName") || filled.includes("lastName"))) {
      const tap = await shell(adb, serial, `input tap ${next.x} ${next.y}`);
      evidence.push(tap.evidence);
      filled.push("tappedNext");
      await sleep(1800);
    }
  }

  const username = input.username?.trim().replace(/@gmail\.com$/i, "");
  if (username) {
    const again = await dumpUi(adb, serial);
    evidence.push(...again.evidence);
    const field =
      findEditable(again.xml, [
        "username",
        "Username",
        "Gmail address",
        "ایمیل",
        "نام کاربری",
      ]) ?? findTapPoint(again.xml, ["Username", "نام کاربری", "ایمیل"]);
    if (field) {
      evidence.push(...(await tapAndType(adb, serial, field, username)));
      filled.push("username");
      const clip = await setClipboard(adb, serial, `${username}@gmail.com`);
      evidence.push(...clip.evidence);
      await sleep(400);
    }
  }

  const password = input.password?.trim();
  if (password) {
    // Password fields often reject `input text` special chars — put on clipboard for paste
    const clip = await setClipboard(adb, serial, password);
    evidence.push(...clip.evidence);
    const again = await dumpUi(adb, serial);
    evidence.push(...again.evidence);
    const field =
      findEditable(again.xml, ["Passwd", "password", "Password", "رمز", "گذرواژه"]) ??
      findTapPoint(again.xml, ["Password", "رمز عبور", "گذرواژه"]);
    if (field) {
      const tap = await shell(adb, serial, `input tap ${field.x} ${field.y}`);
      evidence.push(tap.evidence);
      await sleep(300);
      // Ctrl-V isn't universal on Android; try KEYCODE_PASTE (279) then fallback type
      const paste = await shell(adb, serial, "input keyevent 279");
      evidence.push(paste.evidence);
      if (paste.code !== 0) {
        evidence.push(...(await tapAndType(adb, serial, field, password)));
      }
      filled.push("passwordClipboard");
    } else {
      filled.push("passwordClipboardOnly");
    }
  }

  return { filled, evidence };
}

async function saveGmailNote(input: {
  firstName?: string;
  lastName?: string;
  emailHint: string | null;
  password: string;
}): Promise<string> {
  const dir = path.join(os.homedir(), "Desktop", "Fixo-Notes");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const who =
    [input.firstName, input.lastName].filter(Boolean).join("-").replace(/\s+/g, "-") ||
    "gmail";
  const safe = who.replace(/[^\p{L}\p{N}_-]+/gu, "").slice(0, 40) || "gmail";
  const file = path.join(dir, `${stamp}-gmail-${safe}.txt`);
  const body = [
    "Fixo — یادداشت ساخت جیمیل",
    `تاریخ: ${new Date().toLocaleString("fa-IR")}`,
    `نام: ${input.firstName ?? "—"} ${input.lastName ?? ""}`.trim(),
    `ایمیل پیشنهادی: ${input.emailHint ?? "—"}`,
    `رمز: ${input.password}`,
    "",
    "نکته: تأیید موبایل / کپچا را تعمیرکار روی گوشی کامل می‌کند.",
    "",
  ].join("\n");
  await fs.writeFile(file, body, "utf8");
  return file;
}

/**
 * Best-effort Gmail signup assist for the repair bench:
 * opens Google signup on the phone, optionally fills visible name/username fields,
 * puts password on clipboard, and leaves CAPTCHA / SMS to the human.
 */
export async function assistGmailSignup(
  adb: AdbRunner,
  serial: string,
  input: GmailAssistInput = {},
): Promise<GmailAssistResult> {
  const evidence: string[] = [];
  const firstName = input.firstName?.trim() || undefined;
  const lastName = input.lastName?.trim() || undefined;
  const username = input.username?.trim().replace(/@gmail\.com$/i, "") || undefined;
  const passwordGenerated = !input.password?.trim();
  const password = input.password?.trim() || generateGmailPassword();
  const emailHint = username ? `${username}@gmail.com` : null;
  const tryFill = input.tryFill !== false;
  const saveNote =
    input.saveNote !== undefined
      ? input.saveNote
      : Boolean(firstName || lastName || username);

  const opened = await openSignupOnPhone(adb, serial);
  evidence.push(...opened.evidence);

  let filled: string[] = [];
  if (opened.opened && tryFill && (firstName || lastName || username || password)) {
    try {
      const fill = await tryFillSignupForm(adb, serial, {
        firstName,
        lastName,
        username,
        password,
      });
      filled = fill.filled;
      evidence.push(...fill.evidence);
    } catch (err) {
      evidence.push(
        `fill_error:${err instanceof Error ? err.message : String(err)}`,
      );
    }
  } else if (opened.opened) {
    const clip = await setClipboard(adb, serial, password);
    evidence.push(...clip.evidence);
    if (clip.ok) filled.push("passwordClipboardOnly");
  }

  let notePath: string | undefined;
  if (saveNote) {
    try {
      notePath = await saveGmailNote({
        firstName,
        lastName,
        emailHint,
        password,
      });
    } catch (err) {
      evidence.push(
        `note_error:${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const humanNext = [
    "اگر صفحه باز نشد، دستی Chrome را باز کن و accounts.google.com/signup را بزن.",
    "نام / نام‌خانوادگی را چک کن؛ اگر خالی بود دستی پر کن.",
    username
      ? `نام‌کاربری پیشنهادی: ${username} — اگر گرفته بود یکی دیگر بساز.`
      : "یک نام‌کاربری Gmail انتخاب کن.",
    "رمز روی کلیپبورد گوشی است (و در یادداشت مغازه اگر ذخیره شده).",
    "تأیید موبایل / کپچا را خودت روی گوشی تمام کن — Fixo این مرحله را دور نمی‌زند.",
  ];

  const message = opened.opened
    ? `صفحه ساخت جیمیل روی گوشی باز شد (${opened.strategy}). رمز آماده است${notePath ? " و یادداشت ذخیره شد" : ""}. بقیه (کپچا/پیامک) با تعمیرکار.`
    : "نتوانستیم صفحه ساخت جیمیل را باز کنیم — گوشی وصل است؟ مرورگر دارد؟";

  return {
    ok: opened.opened,
    opened: opened.opened,
    strategy: opened.strategy,
    emailHint,
    password,
    passwordGenerated,
    filled,
    humanNext,
    notePath,
    message,
    evidence,
  };
}
