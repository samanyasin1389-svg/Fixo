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
autoWifi.start(2000);

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
    autoShopWifi: settings.autoShopWifi !== false,
  });
});

app.get("/api/auto-wifi/sessions", (_req, res) => {
  res.json({ ok: true, sessions: autoWifi.getSessions() });
});

app.get("/api/settings", async (_req, res) => {
  const settings = await loadSettings();
  res.json({ ok: true, settings: publicSettings(settings) });
});

app.put("/api/settings", async (req, res) => {
  try {
    const { shopWifiSsid, shopWifiPassword, openaiModel, autoShopWifi } = req.body ?? {};
    const saved = await saveSettings({
      ...(typeof shopWifiSsid === "string" ? { shopWifiSsid } : {}),
      ...(typeof shopWifiPassword === "string" ? { shopWifiPassword } : {}),
      ...(typeof openaiModel === "string" ? { openaiModel } : {}),
      ...(typeof autoShopWifi === "boolean" ? { autoShopWifi } : {}),
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
    await setWifi(adb, serial, enabled);
    await new Promise((r) => setTimeout(r, 800));
    const { status, evidence } = await getNetworkStatus(adb, serial);
    res.json({ ok: true, deviceSerial: serial, status, evidence });
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
