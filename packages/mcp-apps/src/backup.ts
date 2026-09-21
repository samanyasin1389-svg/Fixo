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
  const missing = /does not exist|No such file|error:\s*remote object/i.test(
    result.stdout + result.stderr,
  );
  return { ok: result.code === 0 && !missing, evidence };
}

async function remoteExists(adb: AdbRunner, serial: string, remote: string) {
  const check = await shell(adb, serial, `[ -e ${JSON.stringify(remote)} ] && echo YES || echo NO`);
  return /YES/.test(check.stdout);
}

export type BackupPhase =
  | "starting"
  | "media"
  | "contacts"
  | "paused"
  | "cancelling"
  | "done"
  | "cancelled"
  | "error";

export type BackupProgress = {
  jobId: string;
  deviceSerial: string;
  phase: BackupPhase;
  folder?: string;
  phoneName?: string;
  currentTarget?: string;
  completedSteps: number;
  totalSteps: number;
  percent: number;
  message: string;
  pulled: string[];
  skipped: string[];
  contactsCount?: number;
  error?: string;
};

type BackupControls = {
  paused: boolean;
  cancelled: boolean;
};

export type BackupResult = {
  folder: string;
  phoneName: string;
  pulled: string[];
  skipped: string[];
  contactsFile?: string;
  contactsCount: number;
  evidence: string[];
  cancelled?: boolean;
};

const MEDIA_TARGETS = [
  { remote: "/sdcard/DCIM", localName: "DCIM" },
  { remote: "/sdcard/Pictures", localName: "Pictures" },
  { remote: "/sdcard/Movies", localName: "Movies" },
  { remote: "/sdcard/Video", localName: "Video" },
  { remote: "/sdcard/Videos", localName: "Videos" },
  { remote: "/sdcard/Download", localName: "Download" },
  { remote: "/storage/emulated/0/DCIM", localName: "DCIM_emulated" },
  { remote: "/storage/emulated/0/Pictures", localName: "Pictures_emulated" },
  { remote: "/storage/emulated/0/Movies", localName: "Movies_emulated" },
] as const;

async function waitWhilePaused(controls: BackupControls, onPause?: () => void) {
  let announced = false;
  while (controls.paused && !controls.cancelled) {
    if (!announced) {
      onPause?.();
      announced = true;
    }
    await sleep(250);
  }
}

export async function backupPhoneMediaAndContacts(
  adb: AdbRunner,
  serial: string,
  options?: {
    controls?: BackupControls;
    onProgress?: (progress: Omit<BackupProgress, "jobId" | "deviceSerial"> & {
      phase: BackupPhase;
    }) => void;
  },
): Promise<BackupResult> {
  const controls = options?.controls ?? { paused: false, cancelled: false };
  const evidence: string[] = [];
  const info = await getDeviceInfo(adb, serial);
  const phoneName =
    safeName([info.manufacturer, info.model].filter(Boolean).join("_") || serial) ||
    safeName(serial);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const folder = path.join(desktopRoot(), `${phoneName}_${stamp}`);
  await fs.mkdir(folder, { recursive: true });
  evidence.push(`backup folder=${folder}`);

  const totalSteps = MEDIA_TARGETS.length + 1; // media + contacts
  let completedSteps = 0;
  const pulled: string[] = [];
  const skipped: string[] = [];

  const emit = (
    phase: BackupPhase,
    message: string,
    extra?: Partial<BackupProgress>,
  ) => {
    options?.onProgress?.({
      phase,
      folder,
      phoneName,
      completedSteps,
      totalSteps,
      percent: Math.min(100, Math.round((completedSteps / totalSteps) * 100)),
      message,
      pulled: [...pulled],
      skipped: [...skipped],
      ...extra,
    });
  };

  emit("starting", "شروع بک‌آپ…");

  for (const target of MEDIA_TARGETS) {
    await waitWhilePaused(controls, () => emit("paused", "بک‌آپ متوقف موقت"));
    if (controls.cancelled) {
      emit("cancelled", "بک‌آپ لغو شد");
      return {
        folder,
        phoneName,
        pulled,
        skipped,
        contactsCount: 0,
        evidence,
        cancelled: true,
      };
    }

    emit("media", `در حال کپی ${target.localName}`, { currentTarget: target.remote });
    const exists = await remoteExists(adb, serial, target.remote);
    evidence.push(`exists ${target.remote}=${exists}`);
    if (!exists) {
      skipped.push(target.remote);
      completedSteps += 1;
      emit("media", `رد شد: ${target.localName}`, { currentTarget: target.remote });
      continue;
    }
    const local = path.join(folder, target.localName);
    const result = await adbPull(adb, serial, target.remote, local);
    evidence.push(result.evidence);
    if (result.ok) pulled.push(target.remote);
    else skipped.push(target.remote);
    completedSteps += 1;
  }

  await waitWhilePaused(controls, () => emit("paused", "بک‌آپ متوقف موقت"));
  if (controls.cancelled) {
    emit("cancelled", "بک‌آپ لغو شد");
    return {
      folder,
      phoneName,
      pulled,
      skipped,
      contactsCount: 0,
      evidence,
      cancelled: true,
    };
  }

  emit("contacts", "در حال گرفتن مخاطبین…", { currentTarget: "contacts" });
  const contactsQuery = await shell(
    adb,
    serial,
    "content query --uri content://com.android.contacts/data --projection mimetype:display_name:data1:data2:data3:data4",
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

  const vcfFile = path.join(folder, "contacts.vcf");
  const phoneRows = rows.filter((r) => /phone/i.test(r.mimetype) && r.data);
  const vcf = phoneRows
    .map((r) => {
      const name = r.name || "Unknown";
      return `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${r.data}\nEND:VCARD`;
    })
    .join("\n");
  await fs.writeFile(vcfFile, vcf || "", "utf8");

  const contactsCount = phoneRows.length || rows.length;
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
        contactsCount,
      },
      null,
      2,
    ),
    "utf8",
  );

  completedSteps += 1;

  if (pulled.length === 0 && rows.length === 0) {
    emit("error", "رسانه یا مخاطبی خوانده نشد");
    throw new AdbError(
      "Backup finished but no media folders or contacts were readable. Check USB file permission / MTP access on the phone.",
      evidence,
    );
  }

  emit("done", `بک‌آپ آماده است (${contactsCount} مخاطب)`, { contactsCount });
  await sleep(50);
  return {
    folder,
    phoneName,
    pulled,
    skipped,
    contactsFile,
    contactsCount,
    evidence,
  };
}

type JobRecord = {
  progress: BackupProgress;
  controls: BackupControls;
  promise: Promise<BackupResult>;
};

export class BackupJobManager {
  private jobs = new Map<string, JobRecord>();
  private counter = 0;

  start(adb: AdbRunner, serial: string): BackupProgress {
    const jobId = `bak_${Date.now()}_${++this.counter}`;
    const controls: BackupControls = { paused: false, cancelled: false };
    const progress: BackupProgress = {
      jobId,
      deviceSerial: serial,
      phase: "starting",
      completedSteps: 0,
      totalSteps: MEDIA_TARGETS.length + 1,
      percent: 0,
      message: "شروع بک‌آپ…",
      pulled: [],
      skipped: [],
    };

    const promise = backupPhoneMediaAndContacts(adb, serial, {
      controls,
      onProgress: (p) => {
        Object.assign(progress, p, { jobId, deviceSerial: serial });
      },
    })
      .then((result) => {
        if (result.cancelled) {
          progress.phase = "cancelled";
          progress.message = "بک‌آپ لغو شد";
        } else {
          progress.phase = "done";
          progress.percent = 100;
          progress.folder = result.folder;
          progress.contactsCount = result.contactsCount;
          progress.message = `بک‌آپ آماده است (${result.contactsCount} مخاطب)`;
        }
        return result;
      })
      .catch((err) => {
        progress.phase = "error";
        progress.error = err instanceof Error ? err.message : String(err);
        progress.message = progress.error;
        throw err;
      });

    this.jobs.set(jobId, { progress, controls, promise });
    return { ...progress };
  }

  get(jobId: string): BackupProgress | null {
    const job = this.jobs.get(jobId);
    return job ? { ...job.progress } : null;
  }

  list(): BackupProgress[] {
    return [...this.jobs.values()].map((j) => ({ ...j.progress }));
  }

  pause(jobId: string): BackupProgress | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    if (job.progress.phase === "done" || job.progress.phase === "cancelled") return { ...job.progress };
    job.controls.paused = true;
    job.progress.phase = "paused";
    job.progress.message = "بک‌آپ متوقف موقت";
    return { ...job.progress };
  }

  resume(jobId: string): BackupProgress | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    job.controls.paused = false;
    if (job.progress.phase === "paused") {
      job.progress.phase = "media";
      job.progress.message = "ادامه بک‌آپ…";
    }
    return { ...job.progress };
  }

  cancel(jobId: string): BackupProgress | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    job.controls.cancelled = true;
    job.controls.paused = false;
    job.progress.phase = "cancelling";
    job.progress.message = "در حال لغو…";
    return { ...job.progress };
  }
}

export const backupJobs = new BackupJobManager();

function parseContactsDump(stdout: string) {
  const rows: Array<{ name: string; data: string; mimetype: string }> = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.includes("mimetype=")) continue;
    const mimetype = pick(line, "mimetype") || "";
    const name = pick(line, "display_name") || "";
    const data1 = pick(line, "data1") || "";
    if (!data1 && !name) continue;
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
