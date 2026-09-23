import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AdbError, getDeviceInfo, type AdbRunner } from "@fixo/mcp-network";
import { resolvePackageId } from "./aliases.js";
import { findCatalogApp, type CatalogApp } from "./catalog.js";
import { checkAppInstalled, installFromPlay } from "./play.js";

export type InstallSourceChoice =
  | "auto"
  | "play"
  | "model_search"
  | "local_apk"
  | "github"
  | "url";

export type InstallCascadeOptions = {
  /** Where to start. Default auto follows playReady cascade. */
  source?: InstallSourceChoice;
  /** After preferred source fails, continue the rest of the chain. Default true */
  fallback?: boolean;
  /** When false, Play is removed from the queue entirely. Default true */
  playReady?: boolean;
  timeoutMs?: number;
  /** Optional override paths/urls if not in catalog */
  localApkPath?: string;
  githubRepo?: string;
  apkUrl?: string;
  /** Display name for search query */
  appLabel?: string;
};

export type InstallAttempt = {
  source: Exclude<InstallSourceChoice, "auto">;
  ok: boolean;
  message: string;
  strategy?: string;
  searchUrl?: string;
};

export type InstallCascadeResult = {
  packageId: string;
  installed: boolean;
  usedSource?: Exclude<InstallSourceChoice, "auto">;
  versionName?: string;
  attempts: InstallAttempt[];
  evidence: string[];
  searchUrl?: string;
  /** True when browser was opened for technician download (not a completed install) */
  browserOpened?: boolean;
};

/** With Play: Play → model search → local → GitHub → URL */
const SOURCE_ORDER_WITH_PLAY: Array<Exclude<InstallSourceChoice, "auto">> = [
  "play",
  "model_search",
  "local_apk",
  "github",
  "url",
];

/** Without Play: model search → local → GitHub → URL */
const SOURCE_ORDER_NO_PLAY: Array<Exclude<InstallSourceChoice, "auto">> = [
  "model_search",
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

function buildSearchQuery(parts: {
  label: string;
  packageId: string;
  manufacturer?: string;
  model?: string;
}) {
  const device = [parts.manufacturer, parts.model].filter(Boolean).join(" ").trim();
  const name = parts.label || parts.packageId;
  return [name, device, "apk download"].filter(Boolean).join(" ").trim();
}

export function buildModelSearchUrl(query: string) {
  return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
}

export async function openLaptopBrowser(
  url: string,
): Promise<{ ok: boolean; evidence: string }> {
  const platform = process.platform;
  let cmd: string;
  let args: string[];
  if (platform === "linux") {
    cmd = "xdg-open";
    args = [url];
  } else if (platform === "darwin") {
    cmd = "open";
    args = [url];
  } else if (platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", url];
  } else {
    return { ok: false, evidence: `unsupported platform for browser open: ${platform}` };
  }

  return await new Promise((resolve) => {
    const child = spawn(cmd, args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    child.on("error", (err) => {
      resolve({ ok: false, evidence: `open browser failed: ${err.message}` });
    });
    // Assume success if spawn didn't emit error immediately
    setTimeout(() => {
      resolve({ ok: true, evidence: `opened browser via ${cmd}: ${url}` });
    }, 150);
  });
}

export async function openModelSearch(
  adb: AdbRunner,
  serial: string,
  opts: { label?: string; packageId: string },
): Promise<{ ok: boolean; searchUrl: string; query: string; evidence: string[] }> {
  const evidence: string[] = [];
  const info = await getDeviceInfo(adb, serial);
  evidence.push(
    `device manufacturer=${info.manufacturer ?? "?"} model=${info.model ?? "?"}`,
  );
  const query = buildSearchQuery({
    label: opts.label || opts.packageId,
    packageId: opts.packageId,
    manufacturer: info.manufacturer,
    model: info.model,
  });
  const searchUrl = buildModelSearchUrl(query);
  const opened = await openLaptopBrowser(searchUrl);
  evidence.push(opened.evidence);
  return { ok: opened.ok, searchUrl, query, evidence };
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

function sourceOrder(playReady: boolean): Array<Exclude<InstallSourceChoice, "auto">> {
  return playReady ? [...SOURCE_ORDER_WITH_PLAY] : [...SOURCE_ORDER_NO_PLAY];
}

function buildSourceQueue(
  preferred: InstallSourceChoice,
  fallback: boolean,
  playReady: boolean,
): Array<Exclude<InstallSourceChoice, "auto">> {
  const order = sourceOrder(playReady);
  // auto without fallback = Play only (play-first UX)
  if (preferred === "auto") {
    if (!fallback) {
      return playReady ? ["play"] : [];
    }
    return order;
  }
  if (preferred === "play" && !playReady) {
    return fallback ? order : [];
  }
  if (!fallback) return [preferred];
  const rest = order.filter((s) => s !== preferred);
  return [preferred, ...rest];
}

function hasSourceConfigured(
  source: Exclude<InstallSourceChoice, "auto">,
  app: CatalogApp | undefined,
  options: InstallCascadeOptions,
  playReady: boolean,
): boolean {
  if (source === "play") return playReady && app?.sources.play !== false;
  if (source === "model_search") return true;
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
  const playReady = options.playReady !== false;
  const appLabel = options.appLabel || catalogApp?.label || packageId;

  const queue = buildSourceQueue(preferred, fallback, playReady).filter((s) =>
    hasSourceConfigured(s, catalogApp, options, playReady),
  );

  evidence.push(
    `install cascade package=${packageId} preferred=${preferred} playReady=${playReady} fallback=${fallback} queue=${queue.join(",")}`,
  );

  const already = await checkAppInstalled(adb, serial, packageId);
  evidence.push(...already.evidence);
  if (already.installed) {
    return {
      packageId,
      installed: true,
      usedSource: playReady ? "play" : "local_apk",
      versionName: already.versionName,
      attempts: [
        {
          source: playReady ? "play" : "local_apk",
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
      `هیچ منبع نصبی برای ${packageId} تنظیم نشده. در کاتالوگ APK/GitHub/URL بگذارید یا جستجوی مدل را بزنید.`,
      evidence,
    );
  }

  let lastSearchUrl: string | undefined;
  let browserOpened = false;

  for (const source of queue) {
    try {
      if (source === "model_search") {
        const search = await openModelSearch(adb, serial, {
          label: appLabel,
          packageId,
        });
        evidence.push(...search.evidence);
        lastSearchUrl = search.searchUrl;
        browserOpened = search.ok;
        attempts.push({
          source,
          ok: search.ok,
          message: search.ok
            ? "جستجو در مرورگر باز شد — APK را دانلود کنید"
            : "باز کردن مرورگر ناموفق بود",
          strategy: "xdg_open_search",
          searchUrl: search.searchUrl,
        });
        // model_search never completes install; continue cascade if fallback
        if (preferred === "model_search" && !fallback) {
          return {
            packageId,
            installed: false,
            usedSource: source,
            attempts,
            evidence,
            searchUrl: search.searchUrl,
            browserOpened: search.ok,
          };
        }
        continue;
      }

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
              searchUrl: lastSearchUrl,
              browserOpened,
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
            searchUrl: lastSearchUrl,
            browserOpened,
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
            searchUrl: lastSearchUrl,
            browserOpened,
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
    searchUrl: lastSearchUrl,
    browserOpened,
  };
}

export function getInstallSourceOptions(playReady = true): Array<{
  id: InstallSourceChoice;
  label: string;
  hint: string;
}> {
  const all: Array<{ id: InstallSourceChoice; label: string; hint: string }> = [
    {
      id: "auto",
      label: "خودکار (پیشنهادی)",
      hint: playReady
        ? "پلی، بعد جستجوی مدل، APK، گیت‌هاب، لینک"
        : "جستجوی مدل، بعد APK، گیت‌هاب، لینک",
    },
    { id: "play", label: "گوگل پلی", hint: "اول از فروشگاه پلی" },
    {
      id: "model_search",
      label: "جستجوی مدل‌محور",
      hint: "مدل گوشی را می‌گیرد و جستجو را در مرورگر باز می‌کند",
    },
    { id: "local_apk", label: "فایل APK روی لپ‌تاپ", hint: "مسیر فایل محلی در کاتالوگ" },
    { id: "github", label: "گیت‌هاب", hint: "ریلیز گیت‌هاب" },
    { id: "url", label: "لینک مستقیم", hint: "URL مستقیم APK" },
  ];
  return playReady ? all : all.filter((o) => o.id !== "play");
}

/** @deprecated use getInstallSourceOptions(playReady) */
export const INSTALL_SOURCE_OPTIONS = getInstallSourceOptions(true);
