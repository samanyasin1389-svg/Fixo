#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  AdbError,
  createSystemAdb,
  resolveSerial,
  type AdbRunner,
} from "@fixo/mcp-network";
import { checkAppInstalled, installFromPlay, openPlayListing } from "./play.js";
import { resolvePackageId } from "./aliases.js";

function jsonResult(payload: Record<string, unknown>, ok = true) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ ok, ...payload }, null, 2) }],
    isError: !ok,
  };
}

function fail(err: unknown) {
  if (err instanceof AdbError) {
    return jsonResult({ status: "error", message: err.message, evidence: err.evidence }, false);
  }
  return jsonResult(
    { status: "error", message: err instanceof Error ? err.message : String(err) },
    false,
  );
}

export function createAppsMcpServer(adb: AdbRunner = createSystemAdb()) {
  const server = new McpServer({ name: "fixo-mcp-apps", version: "0.1.0" });

  server.tool(
    "resolve_play_app",
    "Resolve an app name/alias to a Google Play packageId (e.g. whatsapp → com.whatsapp).",
    { nameOrPackageId: z.string() },
    async ({ nameOrPackageId }) => {
      try {
        const resolved = resolvePackageId(nameOrPackageId);
        return jsonResult({
          status: "ok",
          message: `Resolved to ${resolved.packageId}`,
          data: resolved,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "check_app_installed",
    "Check whether a package is installed on the connected Android phone.",
    {
      packageId: z.string(),
      deviceSerial: z.string().optional(),
    },
    async ({ packageId, deviceSerial }) => {
      try {
        const resolved = resolvePackageId(packageId);
        const { serial, evidence } = await resolveSerial(adb, deviceSerial);
        const check = await checkAppInstalled(adb, serial, resolved.packageId);
        return jsonResult({
          deviceSerial: serial,
          status: check.installed ? "installed" : "missing",
          message: check.installed
            ? `${resolved.packageId} is installed (${check.versionName ?? "unknown version"})`
            : `${resolved.packageId} is not installed`,
          data: check,
          evidence: [...evidence, ...check.evidence],
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "open_play_listing",
    "Open the Google Play Store details page for an app on the phone.",
    {
      packageId: z.string(),
      deviceSerial: z.string().optional(),
    },
    async ({ packageId, deviceSerial }) => {
      try {
        const { serial, evidence } = await resolveSerial(adb, deviceSerial);
        const opened = await openPlayListing(adb, serial, packageId);
        return jsonResult({
          deviceSerial: serial,
          status: "opened",
          message: `Opened Play listing for ${opened.packageId}`,
          data: opened,
          evidence: [...evidence, ...opened.evidence],
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "install_from_play",
    "Install an app from Google Play on the phone (opens listing, taps Install/نصب when possible, waits until installed). Requires confirmed=true. Phone needs Play account + internet.",
    {
      packageId: z.string().describe("Play packageId or alias like whatsapp"),
      confirmed: z.boolean().default(false),
      deviceSerial: z.string().optional(),
      timeoutMs: z.number().int().positive().max(300000).optional(),
    },
    async ({ packageId, confirmed, deviceSerial, timeoutMs }) => {
      try {
        if (!confirmed) {
          return jsonResult(
            {
              status: "needs_confirmation",
              message: `Confirmation required before installing ${packageId} from Play`,
            },
            false,
          );
        }
        const { serial, evidence } = await resolveSerial(adb, deviceSerial);
        const result = await installFromPlay(adb, serial, packageId, { timeoutMs });
        return jsonResult({
          deviceSerial: serial,
          status: result.installed ? "installed" : "uncertain",
          message: result.installed
            ? `Installed ${result.packageId} via ${result.strategy}`
            : `Install attempt finished for ${result.packageId}`,
          data: result,
          evidence: [...evidence, ...result.evidence],
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  return server;
}

async function main() {
  const server = createAppsMcpServer();
  await server.connect(new StdioServerTransport());
}

const isDirect = /(?:^|[/\\])server\.(ts|js)$/.test(process.argv[1] ?? "");
if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
