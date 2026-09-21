import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import {
  createSystemAdb,
  listDevices,
  resolveSerial,
  getNetworkStatus,
} from "@fixo/mcp-network";
import { handleChat } from "../agent/chat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../../");
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config();

const PORT = Number(process.env.PORT ?? 8787);
const adb = createSystemAdb();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL ?? "gpt-4.1",
  });
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
    const result = await handleChat({
      messages,
      deviceSerial,
      confirmAction: Boolean(confirmAction),
      adb,
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
