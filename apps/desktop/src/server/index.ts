import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import {
  connectWifi,
  createSystemAdb,
  forgetWifi,
  getNetworkStatus,
  listDevices,
  resolveSerial,
  setWifi,
} from "@fixo/mcp-network";
import { handleChat } from "../agent/chat.js";
import { ShopWifiAutoManager } from "./autoShopWifi.js";
import { loadSettings, publicSettings, saveSettings } from "./settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../../");
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config();

const PORT = Number(process.env.PORT ?? 8787);
const adb = createSystemAdb();
const autoWifi = new ShopWifiAutoManager(adb);
// Auto USB plug/unplug is OFF by default; only start if explicitly enabled in settings/env.
void loadSettings().then((s) => {
  if (s.autoShopWifi === true) autoWifi.start(2000);
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  const settings = await loadSettings();
  res.json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL ?? settings.openaiModel ?? "gpt-4.1",
    shopWifiSsid: settings.shopWifiSsid,
    hasShopWifiPassword: Boolean(settings.shopWifiPassword),
    autoShopWifi: settings.autoShopWifi === true,
  });
});

app.get("/api/auto-wifi/sessions", async (_req, res) => {
  const status = await autoWifi.getStatus();
  res.json({ ok: true, ...status });
});

app.post("/api/auto-wifi/run", async (_req, res) => {
  try {
    const status = await autoWifi.forceRun();
    res.json({ ok: !status.blocker || status.sessions.some((s) => s.phase === "online" || s.phase === "connecting"), ...status });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/settings", async (_req, res) => {
  const settings = await loadSettings();
  res.json({ ok: true, settings: publicSettings(settings) });
});

app.put("/api/settings", async (req, res) => {
  try {
    const { shopWifiSsid, shopWifiPassword, openaiModel, autoShopWifi, theme, locale } =
      req.body ?? {};
    const saved = await saveSettings({
      ...(typeof shopWifiSsid === "string" ? { shopWifiSsid } : {}),
      ...(typeof shopWifiPassword === "string" ? { shopWifiPassword } : {}),
      ...(typeof openaiModel === "string" ? { openaiModel } : {}),
      ...(typeof autoShopWifi === "boolean" ? { autoShopWifi } : {}),
      ...(theme === "day" || theme === "night" ? { theme } : {}),
      ...(locale === "fa" || locale === "en" ? { locale } : {}),
    });
    res.json({ ok: true, settings: publicSettings(saved) });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/devices", async (_req, res) => {
  try {
    const devices = await listDevices(adb);
    res.json({ ok: true, devices });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/network", async (req, res) => {
  try {
    const serialParam =
      typeof req.query.deviceSerial === "string" ? req.query.deviceSerial : undefined;
    const { serial } = await resolveSerial(adb, serialParam);
    const { status, evidence } = await getNetworkStatus(adb, serial);
    res.json({ ok: true, deviceSerial: serial, status, evidence });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/api/network/wifi", async (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const serialParam =
      typeof req.body?.deviceSerial === "string" ? req.body.deviceSerial : undefined;
    const { serial } = await resolveSerial(adb, serialParam);
    const settings = await loadSettings();
    const evidence: string[] = [];

    if (enabled) {
      if (!settings.shopWifiPassword) {
        res.status(400).json({
          ok: false,
          message:
            "رمز وای‌فای مغازه ست نشده. در تنظیمات یا .env مقدار SHOP_WIFI_PASSWORD را بگذار.",
        });
        return;
      }
      const result = await connectWifi(
        adb,
        serial,
        settings.shopWifiSsid,
        settings.shopWifiPassword,
      );
      evidence.push(...result.evidence);
      const { status } = await getNetworkStatus(adb, serial);
      res.json({
        ok: result.connected,
        deviceSerial: serial,
        status,
        evidence,
        strategy: result.strategy,
        message: result.connected
          ? `Wi‑Fi روشن شد و به ${result.wifiSsid ?? settings.shopWifiSsid} وصل شد`
          : `Wi‑Fi روشن شد ولی وصل به ${settings.shopWifiSsid} نامشخص است`,
      });
      return;
    }

    await setWifi(adb, serial, false);
    await new Promise((r) => setTimeout(r, 800));
    const { status, evidence: e2 } = await getNetworkStatus(adb, serial);
    res.json({
      ok: true,
      deviceSerial: serial,
      status,
      evidence: e2,
      message: "Wi‑Fi خاموش شد",
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/api/network/shop-wifi/connect", async (req, res) => {
  try {
    const settings = await loadSettings();
    if (!settings.shopWifiPassword) {
      res.status(400).json({
        ok: false,
        message: "رمز وای‌فای مغازه در تنظیمات برنامه ست نشده است.",
      });
      return;
    }
    const serialParam =
      typeof req.body?.deviceSerial === "string" ? req.body.deviceSerial : undefined;
    const { serial } = await resolveSerial(adb, serialParam);
    const before = await getNetworkStatus(adb, serial);
    const result = await connectWifi(
      adb,
      serial,
      settings.shopWifiSsid,
      settings.shopWifiPassword,
    );
    const after = await getNetworkStatus(adb, serial);
    res.json({
      ok: result.connected,
      deviceSerial: serial,
      strategy: result.strategy,
      before: before.status,
      after: after.status,
      evidence: result.evidence,
      message: result.connected
        ? `وصل شد به ${result.wifiSsid}`
        : "تلاش اتصال انجام شد",
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/api/network/shop-wifi/forget", async (req, res) => {
  try {
    const settings = await loadSettings();
    const serialParam =
      typeof req.body?.deviceSerial === "string" ? req.body.deviceSerial : undefined;
    const { serial } = await resolveSerial(adb, serialParam);
    const before = await getNetworkStatus(adb, serial);
    const result = await forgetWifi(adb, serial, settings.shopWifiSsid);
    const after = await getNetworkStatus(adb, serial);
    res.json({
      ok: result.forgotten,
      deviceSerial: serial,
      strategy: result.strategy,
      before: before.status,
      after: after.status,
      evidence: result.evidence,
      message: `شبکه ${settings.shopWifiSsid} فراموش شد`,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/apps/check", async (req, res) => {
  try {
    const packageId =
      typeof req.query.packageId === "string" ? req.query.packageId : "";
    if (!packageId) {
      res.status(400).json({ ok: false, message: "packageId required" });
      return;
    }
    const serialParam =
      typeof req.query.deviceSerial === "string" ? req.query.deviceSerial : undefined;
    const { serial } = await resolveSerial(adb, serialParam);
    const { resolvePackageId, checkAppInstalled } = await import("@fixo/mcp-apps");
    const resolved = resolvePackageId(packageId);
    const check = await checkAppInstalled(adb, serial, resolved.packageId);
    res.json({
      ok: true,
      deviceSerial: serial,
      packageId: resolved.packageId,
      ...check,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/api/apps/open-play", async (req, res) => {
  try {
    const packageId = String(req.body?.packageId ?? "");
    const serialParam =
      typeof req.body?.deviceSerial === "string" ? req.body.deviceSerial : undefined;
    const { serial } = await resolveSerial(adb, serialParam);
    const { openPlayListing } = await import("@fixo/mcp-apps");
    const opened = await openPlayListing(adb, serial, packageId);
    res.json({
      ok: true,
      deviceSerial: serial,
      packageId: opened.packageId,
      evidence: opened.evidence,
      message: `صفحه Play برای ${opened.packageId} باز شد`,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/api/apps/install-play", async (req, res) => {
  try {
    const packageId = String(req.body?.packageId ?? "");
    const serialParam =
      typeof req.body?.deviceSerial === "string" ? req.body.deviceSerial : undefined;
    const { serial } = await resolveSerial(adb, serialParam);
    const { installFromPlay } = await import("@fixo/mcp-apps");
    const result = await installFromPlay(adb, serial, packageId, {
      timeoutMs: Number(req.body?.timeoutMs) || 120_000,
    });
    res.json({
      ok: result.installed,
      deviceSerial: serial,
      ...result,
      message: result.installed
        ? `${result.packageId} نصب شد`
        : `نصب ${result.packageId} کامل نشد`,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/apps/catalog", async (req, res) => {
  try {
    const { listCatalogApps, getInstallSourceOptions, catalogFilePath } =
      await import("@fixo/mcp-apps");
    const playReady = req.query.playReady !== "0" && req.query.playReady !== "false";
    const apps = await listCatalogApps();
    res.json({
      ok: true,
      apps,
      sources: getInstallSourceOptions(playReady),
      catalogPath: catalogFilePath(),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/api/apps/catalog", async (req, res) => {
  try {
    const body = req.body ?? {};
    const packageId = String(body.packageId ?? "").trim();
    const label = String(body.label ?? "").trim();
    if (!packageId || !label) {
      res.status(400).json({ ok: false, message: "label و packageId لازم است" });
      return;
    }
    const { upsertCatalogApp } = await import("@fixo/mcp-apps");
    const app = await upsertCatalogApp({
      id: typeof body.id === "string" ? body.id : "",
      label,
      packageId,
      pinned: Boolean(body.pinned),
      sources: {
        play: body.play !== false,
        localApkPath: typeof body.localApkPath === "string" ? body.localApkPath : undefined,
        githubRepo: typeof body.githubRepo === "string" ? body.githubRepo : undefined,
        apkUrl: typeof body.apkUrl === "string" ? body.apkUrl : undefined,
      },
    });
    res.json({ ok: true, app, message: `${app.label} به کاتالوگ اضافه شد` });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/api/apps/open-search", async (req, res) => {
  try {
    const packageId = String(req.body?.packageId ?? "");
    const appLabel =
      typeof req.body?.appLabel === "string" ? req.body.appLabel : undefined;
    if (!packageId) {
      res.status(400).json({ ok: false, message: "packageId required" });
      return;
    }
    const serialParam =
      typeof req.body?.deviceSerial === "string" ? req.body.deviceSerial : undefined;
    const { serial } = await resolveSerial(adb, serialParam);
    const { openModelSearch } = await import("@fixo/mcp-apps");
    const result = await openModelSearch(adb, serial, {
      packageId,
      label: appLabel,
    });
    res.json({
      deviceSerial: serial,
      ...result,
      ok: result.ok,
      message: result.ok
        ? "جستجو در مرورگر باز شد — APK را دانلود کنید"
        : "باز کردن مرورگر ناموفق بود",
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/api/apps/install", async (req, res) => {
  try {
    const packageId = String(req.body?.packageId ?? "");
    if (!packageId) {
      res.status(400).json({ ok: false, message: "packageId required" });
      return;
    }
    const serialParam =
      typeof req.body?.deviceSerial === "string" ? req.body.deviceSerial : undefined;
    const { serial } = await resolveSerial(adb, serialParam);
    const { installAppCascade } = await import("@fixo/mcp-apps");
    const source = req.body?.source;
    const allowed = new Set([
      "auto",
      "play",
      "model_search",
      "local_apk",
      "github",
      "url",
    ]);
    const result = await installAppCascade(adb, serial, packageId, {
      source: allowed.has(source) ? source : "auto",
      playReady: req.body?.playReady !== false,
      fallback: req.body?.fallback !== false,
      appLabel: typeof req.body?.appLabel === "string" ? req.body.appLabel : undefined,
      localApkPath:
        typeof req.body?.localApkPath === "string" ? req.body.localApkPath : undefined,
      githubRepo: typeof req.body?.githubRepo === "string" ? req.body.githubRepo : undefined,
      apkUrl: typeof req.body?.apkUrl === "string" ? req.body.apkUrl : undefined,
      timeoutMs: Number(req.body?.timeoutMs) || 90_000,
    });
    const ok = result.installed || (result.browserOpened && source === "model_search");
    res.json({
      ok,
      deviceSerial: serial,
      ...result,
      message: result.installed
        ? `${result.packageId} از ${result.usedSource ?? "cascade"} نصب شد`
        : result.browserOpened
          ? "جستجو در مرورگر باز شد — بعد از دانلود از APK محلی یا لینک نصب کنید"
          : `نصب ${result.packageId} ناموفق بود`,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/api/backup", async (req, res) => {
  try {
    const serialParam =
      typeof req.body?.deviceSerial === "string" ? req.body.deviceSerial : undefined;
    const { serial } = await resolveSerial(adb, serialParam);
    const { backupJobs } = await import("@fixo/mcp-apps");
    const progress = backupJobs.start(adb, serial);
    res.json({
      ok: true,
      deviceSerial: serial,
      job: progress,
      message: "بک‌آپ شروع شد",
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/backup/:jobId", async (req, res) => {
  try {
    const { backupJobs } = await import("@fixo/mcp-apps");
    const job = backupJobs.get(String(req.params.jobId));
    if (!job) {
      res.status(404).json({ ok: false, message: "job پیدا نشد" });
      return;
    }
    res.json({ ok: true, job });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/api/backup/:jobId/:action", async (req, res) => {
  try {
    const action = String(req.params.action);
    const jobId = String(req.params.jobId);
    const { backupJobs } = await import("@fixo/mcp-apps");
    let job = null;
    if (action === "pause") job = backupJobs.pause(jobId);
    else if (action === "resume") job = backupJobs.resume(jobId);
    else if (action === "cancel") job = backupJobs.cancel(jobId);
    else {
      res.status(400).json({ ok: false, message: "action باید pause|resume|cancel باشد" });
      return;
    }
    if (!job) {
      res.status(404).json({ ok: false, message: "job پیدا نشد" });
      return;
    }
    res.json({ ok: true, job });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      res.status(400).json({
        ok: false,
        message: "OPENAI_API_KEY is missing. Set it in the project .env file.",
      });
      return;
    }
    const { messages, deviceSerial, confirmAction } = req.body ?? {};
    if (!Array.isArray(messages)) {
      res.status(400).json({ ok: false, message: "messages array required" });
      return;
    }
    const settings = await loadSettings();
    const result = await handleChat({
      messages,
      deviceSerial,
      confirmAction: Boolean(confirmAction),
      adb,
      shopWifi: {
        ssid: settings.shopWifiSsid,
        password: settings.shopWifiPassword,
      },
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

const uiDist = path.resolve(__dirname, "../../dist/ui");
app.use(express.static(uiDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(uiDist, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Fixo desktop agent listening on http://127.0.0.1:${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.warn("Warning: OPENAI_API_KEY is not set");
  }
});
