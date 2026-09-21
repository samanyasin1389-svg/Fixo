#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import type { ToolResult } from "@fixo/shared";
import {
  AdbError,
  createSystemAdb,
  listDevices,
  resolveSerial,
  type AdbRunner,
} from "./adb.js";
import {
  assertConfirmed,
  getDeviceInfo,
  getNetworkStatus,
  setAirplaneMode,
  setMobileData,
  setWifi,
} from "./network.js";

function jsonResult(result: ToolResult) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
    isError: !result.ok,
  };
}

function fail(err: unknown, extra?: Partial<ToolResult>): ReturnType<typeof jsonResult> {
  if (err instanceof AdbError) {
    return jsonResult({
      ok: false,
      status: "error",
      message: err.message,
      evidence: err.evidence,
      ...extra,
    });
  }
  const message = err instanceof Error ? err.message : String(err);
  return jsonResult({
    ok: false,
    status: "error",
    message,
    evidence: [],
    ...extra,
  });
}

export function createNetworkMcpServer(adb: AdbRunner = createSystemAdb()) {
  const server = new McpServer({
    name: "fixo-mcp-network",
    version: "0.1.0",
  });

  server.tool(
    "list_devices",
    "List Android devices connected over ADB and their authorization status.",
    {},
    async () => {
      try {
        const devices = await listDevices(adb);
        return jsonResult({
          ok: true,
          status: "ok",
          message:
            devices.length === 0
              ? "No devices found"
              : `Found ${devices.length} device(s)`,
          evidence: [],
          data: { devices },
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "get_device_info",
    "Get model, manufacturer, and Android version for a connected device.",
    {
      deviceSerial: z
        .string()
        .optional()
        .describe("ADB serial. Optional if exactly one device is connected."),
    },
    async ({ deviceSerial }) => {
      try {
        const { serial, evidence } = await resolveSerial(adb, deviceSerial);
        const info = await getDeviceInfo(adb, serial);
        return jsonResult({
          ok: true,
          deviceSerial: serial,
          status: "ok",
          message: `Device ${info.manufacturer ?? ""} ${info.model ?? serial}`.trim(),
          evidence,
          data: info,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "get_network_status",
    "Read Wi-Fi, mobile data, and airplane mode status from the phone.",
    {
      deviceSerial: z.string().optional(),
    },
    async ({ deviceSerial }) => {
      try {
        const { serial, evidence: e1 } = await resolveSerial(adb, deviceSerial);
        const { status, evidence: e2 } = await getNetworkStatus(adb, serial);
        return jsonResult({
          ok: true,
          deviceSerial: serial,
          status: "ok",
          message: summarizeNetwork(status),
          after: status,
          evidence: [...e1, ...e2],
          data: status,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "set_wifi",
    "Enable or disable Wi-Fi on the connected Android phone. Requires confirmed=true after technician approval.",
    {
      enabled: z.boolean().describe("true to turn Wi-Fi on, false to turn off"),
      confirmed: z
        .boolean()
        .default(false)
        .describe("Must be true after the technician confirms the action"),
      deviceSerial: z.string().optional(),
    },
    async ({ enabled, confirmed, deviceSerial }) => {
      try {
        assertConfirmed(confirmed, enabled ? "enabling Wi-Fi" : "disabling Wi-Fi");
        const { serial, evidence: e0 } = await resolveSerial(adb, deviceSerial);
        const before = await getNetworkStatus(adb, serial);
        const change = await setWifi(adb, serial, enabled);
        // Give radio a moment
        await sleep(800);
        const after = await getNetworkStatus(adb, serial);
        const matched = after.status.wifiEnabled === enabled;
        return jsonResult({
          ok: matched || after.status.wifiEnabled === null,
          deviceSerial: serial,
          status: matched ? "applied" : "uncertain",
          message: matched
            ? `Wi-Fi is now ${enabled ? "ON" : "OFF"}`
            : `Wi-Fi command sent (${enabled ? "enable" : "disable"}) but status could not be verified. Check the phone.`,
          before: before.status,
          after: after.status,
          evidence: [...e0, ...before.evidence, ...change.evidence, ...after.evidence],
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "set_mobile_data",
    "Enable or disable mobile data on the connected Android phone. Requires confirmed=true after technician approval.",
    {
      enabled: z.boolean(),
      confirmed: z.boolean().default(false),
      deviceSerial: z.string().optional(),
    },
    async ({ enabled, confirmed, deviceSerial }) => {
      try {
        assertConfirmed(
          confirmed,
          enabled ? "enabling mobile data" : "disabling mobile data",
        );
        const { serial, evidence: e0 } = await resolveSerial(adb, deviceSerial);
        const before = await getNetworkStatus(adb, serial);
        const change = await setMobileData(adb, serial, enabled);
        await sleep(800);
        const after = await getNetworkStatus(adb, serial);
        const matched =
          after.status.mobileDataEnabled === null ||
          after.status.mobileDataEnabled === enabled;
        return jsonResult({
          ok: matched,
          deviceSerial: serial,
          status: after.status.mobileDataEnabled === enabled ? "applied" : "uncertain",
          message:
            after.status.mobileDataEnabled === enabled
              ? `Mobile data is now ${enabled ? "ON" : "OFF"}`
              : `Mobile data command sent. Some phones block this over ADB; verify on device.`,
          before: before.status,
          after: after.status,
          evidence: [...e0, ...before.evidence, ...change.evidence, ...after.evidence],
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "set_airplane_mode",
    "Enable or disable airplane mode (cuts all radios). Requires confirmed=true after technician approval.",
    {
      enabled: z.boolean(),
      confirmed: z.boolean().default(false),
      deviceSerial: z.string().optional(),
    },
    async ({ enabled, confirmed, deviceSerial }) => {
      try {
        assertConfirmed(
          confirmed,
          enabled ? "enabling airplane mode" : "disabling airplane mode",
        );
        const { serial, evidence: e0 } = await resolveSerial(adb, deviceSerial);
        const before = await getNetworkStatus(adb, serial);
        const change = await setAirplaneMode(adb, serial, enabled);
        await sleep(1000);
        const after = await getNetworkStatus(adb, serial);
        const matched = after.status.airplaneMode === enabled;
        return jsonResult({
          ok: matched || after.status.airplaneMode === null,
          deviceSerial: serial,
          status: matched ? "applied" : "uncertain",
          message: matched
            ? `Airplane mode is now ${enabled ? "ON" : "OFF"}`
            : `Airplane mode command sent but status uncertain. Some OEMs require root for this.`,
          before: before.status,
          after: after.status,
          evidence: [...e0, ...before.evidence, ...change.evidence, ...after.evidence],
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  return server;
}

function summarizeNetwork(status: {
  wifiEnabled: boolean | null;
  mobileDataEnabled: boolean | null;
  airplaneMode: boolean | null;
}) {
  const parts = [
    `Wi-Fi=${fmt(status.wifiEnabled)}`,
    `MobileData=${fmt(status.mobileDataEnabled)}`,
    `Airplane=${fmt(status.airplaneMode)}`,
  ];
  return parts.join(", ");
}

function fmt(v: boolean | null) {
  if (v === null) return "unknown";
  return v ? "ON" : "OFF";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const server = createNetworkMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isDirect = /(?:^|[/\\])server\.(ts|js)$/.test(process.argv[1] ?? "");

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
