import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  AdbError,
  type AdbRunner,
  getDeviceInfo,
  shell,
} from "@fixo/mcp-network";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeName(input: string) {
  return input
    .trim()
    .replace(/[^\w\u0600-\u06FF.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

function desktopRoot() {
  return process.env.FIXO_BACKUP_DIR || path.join(os.homedir(), "Desktop", "Fixo-Backups");
}

async function adbPull(
  adb: AdbRunner,
  serial: string,
  remote: string,
  local: string,
): Promise<{ ok: boolean; evidence: string }> {
  await fs.mkdir(local, { recursive: true });
  const result = await adb.run(["-s", serial, "pull", remote, local], {
    timeoutMs: 600_000,
  });
  const evidence = `adb -s ${serial} pull ${remote} ${local}\nexit=${result.code}\nstdout=${result.stdout.trim()}\nstderr=${result.stderr.trim()}`;
  // adb pull returns 1 if remote missing; treat as soft miss
  const missing = /does not exist|No such file|error:\s*remote object/i.test(
    result.stdout + result.stderr,
  );
  return { ok: result.code === 0 && !missing, evidence };
}

async function remoteExists(adb: AdbRunner, serial: string, remote: string) {
  const check = await shell(adb, serial, `[ -e ${JSON.stringify(remote)} ] && echo YES || echo NO`);
  return /YES/.test(check.stdout);
}

export async function backupPhoneMediaAndContacts(
  adb: AdbRunner,
  serial: string,
): Promise<{
  folder: string;
  phoneName: string;
  pulled: string[];
  skipped: string[];
  contactsFile?: string;
  contactsCount: number;
  evidence: string[];
}> {
  const evidence: string[] = [];
  const info = await getDeviceInfo(adb, serial);
  const phoneName =
    safeName([info.manufacturer, info.model].filter(Boolean).join("_") || serial) ||
    safeName(serial);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const folder = path.join(desktopRoot(), `${phoneName}_${stamp}`);
  await fs.mkdir(folder, { recursive: true });
  evidence.push(`backup folder=${folder}`);

  const mediaTargets = [
    { remote: "/sdcard/DCIM", localName: "DCIM" },
    { remote: "/sdcard/Pictures", localName: "Pictures" },
    { remote: "/sdcard/Movies", localName: "Movies" },
    { remote: "/sdcard/Video", localName: "Video" },
    { remote: "/sdcard/Videos", localName: "Videos" },
    { remote: "/sdcard/Download", localName: "Download" },
    { remote: "/storage/emulated/0/DCIM", localName: "DCIM_emulated" },
    { remote: "/storage/emulated/0/Pictures", localName: "Pictures_emulated" },
    { remote: "/storage/emulated/0/Movies", localName: "Movies_emulated" },
  ];

  const pulled: string[] = [];
  const skipped: string[] = [];

  for (const target of mediaTargets) {
    const exists = await remoteExists(adb, serial, target.remote);
    evidence.push(`exists ${target.remote}=${exists}`);
    if (!exists) {
      skipped.push(target.remote);
      continue;
    }
    const local = path.join(folder, target.localName);
    const result = await adbPull(adb, serial, target.remote, local);
    evidence.push(result.evidence);
    if (result.ok) pulled.push(target.remote);
    else skipped.push(target.remote);
  }

  // Contacts via content provider → CSV
  const contactsQuery = await shell(
    adb,
    serial,
    'content query --uri content://com.android.contacts/data --projection mimetype:display_name:data1:data2:data3:data4',
    60_000,
  );
  evidence.push(contactsQuery.evidence);

  const rows = parseContactsDump(contactsQuery.stdout);
  const contactsFile = path.join(folder, "contacts.csv");
  const csv = [
    "display_name,phone_or_data,mimetype",
    ...rows.map((r) =>
      [csvEscape(r.name), csvEscape(r.data), csvEscape(r.mimetype)].join(","),
    ),
  ].join("\n");
  await fs.writeFile(contactsFile, csv, "utf8");

  // Also write a simple VCF for phone numbers
  const vcfFile = path.join(folder, "contacts.vcf");
  const phoneRows = rows.filter((r) => /phone/i.test(r.mimetype) && r.data);
  const vcf = phoneRows
    .map((r) => {
      const name = r.name || "Unknown";
      return `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${r.data}\nEND:VCARD`;
    })
    .join("\n");
  await fs.writeFile(vcfFile, vcf || "", "utf8");

  await fs.writeFile(
    path.join(folder, "backup-info.json"),
    JSON.stringify(
      {
        serial,
        phoneName,
        model: info.model,
        manufacturer: info.manufacturer,
        androidVersion: info.androidVersion,
        createdAt: new Date().toISOString(),
        pulled,
        skipped,
        contactsCount: phoneRows.length || rows.length,
      },
      null,
      2,
    ),
    "utf8",
  );

  if (pulled.length === 0 && rows.length === 0) {
    throw new AdbError(
      "Backup finished but no media folders or contacts were readable. Check USB file permission / MTP access on the phone.",
      evidence,
    );
  }

  await sleep(100);
  return {
    folder,
    phoneName,
    pulled,
    skipped,
    contactsFile,
    contactsCount: phoneRows.length || rows.length,
    evidence,
  };
}

function parseContactsDump(stdout: string) {
  const rows: Array<{ name: string; data: string; mimetype: string }> = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.includes("mimetype=")) continue;
    const mimetype = pick(line, "mimetype") || "";
    const name = pick(line, "display_name") || "";
    const data1 = pick(line, "data1") || "";
    if (!data1 && !name) continue;
    // Prefer phone/email rows
    if (
      /vnd\.android\.cursor\.item\/phone/i.test(mimetype) ||
      /vnd\.android\.cursor\.item\/email/i.test(mimetype) ||
      /vnd\.android\.cursor\.item\/name/i.test(mimetype)
    ) {
      rows.push({ name, data: data1, mimetype });
    }
  }
  return rows;
}

function pick(line: string, key: string) {
  const re = new RegExp(`${key}=([^,\\n]*)`);
  const m = line.match(re);
  return m?.[1]?.trim();
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
