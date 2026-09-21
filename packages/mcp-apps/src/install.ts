import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AdbError, type AdbRunner } from "@fixo/mcp-network";
import { resolvePackageId } from "./aliases.js";
import { findCatalogApp, type CatalogApp } from "./catalog.js";
import { checkAppInstalled, installFromPlay } from "./play.js";

export type InstallSourceChoice = "auto" | "play" | "local_apk" | "github" | "url";

export type InstallCascadeOptions = {
  /** Where to start. Default auto = Play → local → GitHub → URL */
  source?: InstallSourceChoice;
  /** After preferred source fails, continue the rest of the chain. Default true */
  fallback?: boolean;
  timeoutMs?: number;
  /** Optional override paths/urls if not in catalog */
  localApkPath?: string;
  githubRepo?: string;
  apkUrl?: string;
};

export type InstallAttempt = {
  source: Exclude<InstallSourceChoice, "auto">;
  ok: boolean;
  message: string;
  strategy?: string;
};

export type InstallCascadeResult = {
  packageId: string;
  installed: boolean;
  usedSource?: Exclude<InstallSourceChoice, "auto">;
  versionName?: string;
  attempts: InstallAttempt[];
  evidence: string[];
};

const SOURCE_ORDER: Array<Exclude<InstallSourceChoice, "auto">> = [
  "play",
  "local_apk",
  "github",
  "url",
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function tmpDir() {
  return path.join(os.tmpdir(), "fixo-apks");
}

async function downloadToFile(url: string, dest: string, evidence: string[]) {
  evidence.push(`download ${url} -> ${dest}`);
  const res = await fetch(url, {
    headers: { "User-Agent": "Fixo/0.1 (+repair-shop)" },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}) for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buf);
  evidence.push(`downloaded bytes=${buf.length}`);
  return dest;
}

async function installLocalApk(
  adb: AdbRunner,
  serial: string,
  apkPath: string,
  evidence: string[],
): Promise<{ ok: boolean; strategy: string; message: string }> {
  const stat = await fs.stat(apkPath).catch(() => null);
  if (!stat?.isFile()) {
    return { ok: false, strategy: "local_apk_missing", message: `فایل APK پیدا نشد: ${apkPath}` };
  }
  const result = await adb.run(["-s", serial, "install", "-r", apkPath], {
    timeoutMs: 180_000,
  });
  const out = `${result.stdout}\n${result.stderr}`;
  evidence.push(
    `adb install -r ${apkPath}\nexit=${result.code}\nstdout=${result.stdout.trim()}\nstderr=${result.stderr.trim()}`,
  );
  const ok = result.code === 0 && /success/i.test(out);
  return {
    ok,
    strategy: "adb_install_local",
    message: ok ? "APK محلی نصب شد" : `نصب APK محلی ناموفق: ${out.trim().slice(0, 200)}`,
  };
}

async function resolveGithubApkUrl(repo: string, evidence: string[]): Promise<string> {
  const api = `https://api.github.com/repos/${repo}/releases/latest`;
  evidence.push(`github releases ${api}`);
  const res = await fetch(api, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Fixo/0.1 (+repair-shop)",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub release lookup failed (${res.status}) for ${repo}`);
  }
  const data = (await res.json()) as {
    assets?: Array<{ name: string; browser_download_url: string }>;
    tag_name?: string;
  };
  const assets = data.assets ?? [];
  const apk =
    assets.find((a) => /\.apk$/i.test(a.name) && !/arm64-v8a|armeabi|x86/i.test(a.name)) ||
    assets.find((a) => /\.apk$/i.test(a.name));
  if (!apk) {
    throw new Error(`No APK asset in latest release of ${repo}`);
  }
  evidence.push(`github asset=${apk.name} tag=${data.tag_name ?? "?"}`);
  return apk.browser_download_url;
}

function buildSourceQueue(
  preferred: InstallSourceChoice,
  fallback: boolean,
): Array<Exclude<InstallSourceChoice, "auto">> {
  if (preferred === "auto") return [...SOURCE_ORDER];
  if (!fallback) return [preferred];
  const rest = SOURCE_ORDER.filter((s) => s !== preferred);
  return [preferred, ...rest];
}

function hasSourceConfigured(
  source: Exclude<InstallSourceChoice, "auto">,
  app: CatalogApp | undefined,
  options: InstallCascadeOptions,
): boolean {
  if (source === "play") return app?.sources.play !== false;
  if (source === "local_apk") {
    return Boolean(options.localApkPath || app?.sources.localApkPath);
  }
  if (source === "github") {
    return Boolean(options.githubRepo || app?.sources.githubRepo);
  }
  if (source === "url") {
    return Boolean(options.apkUrl || app?.sources.apkUrl);
  }
  return false;
}

export async function installAppCascade(
  adb: AdbRunner,
  serial: string,
  packageIdOrName: string,
  options: InstallCascadeOptions = {},
): Promise<InstallCascadeResult> {
  const evidence: string[] = [];
  const attempts: InstallAttempt[] = [];
  const resolved = resolvePackageId(packageIdOrName);
  const packageId = resolved.packageId;
  const catalogApp = await findCatalogApp(packageId);
  const preferred = options.source ?? "auto";
  const fallback = options.fallback !== false;
  const queue = buildSourceQueue(preferred, fallback).filter((s) =>
    hasSourceConfigured(s, catalogApp, options),
  );

  evidence.push(
    `install cascade package=${packageId} preferred=${preferred} fallback=${fallback} queue=${queue.join(",")}`,
  );

  const already = await checkAppInstalled(adb, serial, packageId);
  evidence.push(...already.evidence);
  if (already.installed) {
    return {
      packageId,
      installed: true,
      usedSource: "play",
      versionName: already.versionName,
      attempts: [
        {
          source: "play",
          ok: true,
          message: "از قبل نصب بود",
          strategy: "already_installed",
        },
      ],
      evidence,
    };
  }

  if (queue.length === 0) {
    throw new AdbError(
      `هیچ منبع نصبی برای ${packageId} تنظیم نشده. در کاتالوگ Play/APK/GitHub/URL بگذارید.`,
      evidence,
    );
  }

  for (const source of queue) {
    try {
      if (source === "play") {
        try {
          const result = await installFromPlay(adb, serial, packageId, {
            timeoutMs: options.timeoutMs ?? 90_000,
          });
          evidence.push(...result.evidence);
          attempts.push({
            source,
            ok: result.installed,
            message: result.installed ? "از پلی نصب شد" : "پلی کامل نشد",
            strategy: result.strategy,
          });
          if (result.installed) {
            return {
              packageId,
              installed: true,
              usedSource: source,
              versionName: result.versionName,
              attempts,
              evidence,
            };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (err instanceof AdbError) evidence.push(...err.evidence);
          attempts.push({ source, ok: false, message: msg, strategy: "play_failed" });
          evidence.push(`play failed: ${msg}`);
        }
        continue;
      }

      if (source === "local_apk") {
        const apkPath = options.localApkPath || catalogApp?.sources.localApkPath;
        if (!apkPath) {
          attempts.push({
            source,
            ok: false,
            message: "مسیر APK محلی نیست",
            strategy: "skip",
          });
          continue;
        }
        const result = await installLocalApk(adb, serial, apkPath, evidence);
        attempts.push({
          source,
          ok: result.ok,
          message: result.message,
          strategy: result.strategy,
        });
        if (result.ok) {
          const check = await checkAppInstalled(adb, serial, packageId);
          evidence.push(...check.evidence);
          return {
            packageId,
            installed: check.installed || result.ok,
            usedSource: source,
            versionName: check.versionName,
            attempts,
            evidence,
          };
        }
        continue;
      }

      if (source === "github" || source === "url") {
        let apkUrl = options.apkUrl || catalogApp?.sources.apkUrl;
        if (source === "github") {
          const repo = options.githubRepo || catalogApp?.sources.githubRepo;
          if (!repo) {
            attempts.push({
              source,
              ok: false,
              message: "githubRepo تنظیم نشده",
              strategy: "skip",
            });
            continue;
          }
          apkUrl = await resolveGithubApkUrl(repo, evidence);
        }
        if (!apkUrl) {
          attempts.push({
            source,
            ok: false,
            message: "لینک APK نیست",
            strategy: "skip",
          });
          continue;
        }
        const dest = path.join(
          tmpDir(),
          `${packageId.replace(/\./g, "_")}_${Date.now()}.apk`,
        );
        await downloadToFile(apkUrl, dest, evidence);
        const result = await installLocalApk(adb, serial, dest, evidence);
        attempts.push({
          source,
          ok: result.ok,
          message: result.message,
          strategy: result.strategy,
        });
        await fs.unlink(dest).catch(() => undefined);
        if (result.ok) {
          const check = await checkAppInstalled(adb, serial, packageId);
          evidence.push(...check.evidence);
          return {
            packageId,
            installed: check.installed || result.ok,
            usedSource: source,
            versionName: check.versionName,
            attempts,
            evidence,
          };
        }
        continue;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      attempts.push({ source, ok: false, message: msg });
      evidence.push(`${source} error: ${msg}`);
    }
    await sleep(200);
  }

  return {
    packageId,
    installed: false,
    attempts,
    evidence,
  };
}

export const INSTALL_SOURCE_OPTIONS: Array<{
  id: InstallSourceChoice;
  label: string;
  hint: string;
}> = [
  { id: "auto", label: "خودکار (پیشنهادی)", hint: "پلی، بعد APK، بعد گیت‌هاب، بعد لینک" },
  { id: "play", label: "گوگل پلی", hint: "اول از فروشگاه پلی" },
  { id: "local_apk", label: "فایل APK روی لپ‌تاپ", hint: "مسیر فایل محلی در کاتالوگ" },
  { id: "github", label: "گیت‌هاب / لینک مستقیم", hint: "ریلیز گیت‌هاب یا URL مستقیم" },
];
