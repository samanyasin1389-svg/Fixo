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
import { installAppCascade } from "./install.js";
import { listCatalogApps, upsertCatalogApp } from "./catalog.js";
import { backupJobs } from "./backup.js";

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
    "Install an app from Google Play on the phone immediately (no confirmation). Opens listing, taps Install/نصب when possible, waits until installed. Phone needs Play account + internet.",
    {
      packageId: z.string().describe("Play packageId or alias like whatsapp"),
      deviceSerial: z.string().optional(),
      timeoutMs: z.number().int().positive().max(300000).optional(),
    },
    async ({ packageId, deviceSerial, timeoutMs }) => {
      try {
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

  server.tool(
    "install_app",
    "Install an app with cascade. playReady=false skips Play. Sources: Play → model_search (opens laptop browser) → local APK → GitHub → URL.",
    {
      packageId: z.string(),
      deviceSerial: z.string().optional(),
      source: z
        .enum(["auto", "play", "model_search", "local_apk", "github", "url"])
        .optional(),
      playReady: z.boolean().optional(),
      fallback: z.boolean().optional(),
      appLabel: z.string().optional(),
      localApkPath: z.string().optional(),
      githubRepo: z.string().optional(),
      apkUrl: z.string().optional(),
      timeoutMs: z.number().int().positive().max(300000).optional(),
    },
    async (args) => {
      try {
        const { serial, evidence } = await resolveSerial(adb, args.deviceSerial);
        const result = await installAppCascade(adb, serial, args.packageId, {
          source: args.source,
          playReady: args.playReady,
          fallback: args.fallback,
          appLabel: args.appLabel,
          localApkPath: args.localApkPath,
          githubRepo: args.githubRepo,
          apkUrl: args.apkUrl,
          timeoutMs: args.timeoutMs,
        });
        const status = result.installed
          ? "installed"
          : result.browserOpened
            ? "browser_opened"
            : "failed";
        return jsonResult({
          deviceSerial: serial,
          status,
          message: result.installed
            ? `Installed ${result.packageId} via ${result.usedSource}`
            : result.browserOpened
              ? `Search opened for ${result.packageId}; download APK then install locally`
              : `Install failed for ${result.packageId}`,
          data: result,
          evidence: [...evidence, ...result.evidence],
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "open_model_search",
    "Read phone model and open a DuckDuckGo APK search in the laptop browser for the technician to download manually.",
    {
      packageId: z.string(),
      appLabel: z.string().optional(),
      deviceSerial: z.string().optional(),
    },
    async (args) => {
      try {
        const { openModelSearch } = await import("./install.js");
        const { serial, evidence } = await resolveSerial(adb, args.deviceSerial);
        const result = await openModelSearch(adb, serial, {
          packageId: args.packageId,
          label: args.appLabel,
        });
        return jsonResult({
          deviceSerial: serial,
          status: result.ok ? "opened" : "failed",
          message: result.ok
            ? "جستجو در مرورگر باز شد"
            : "باز کردن مرورگر ناموفق بود",
          data: result,
          evidence: [...evidence, ...result.evidence],
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "list_catalog_apps",
    "List Fixo local apps catalog (labels, packageIds, install sources).",
    {},
    async () => {
      try {
        const apps = await listCatalogApps();
        return jsonResult({ status: "ok", message: `${apps.length} apps`, data: { apps } });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "add_catalog_app",
    "Add or update an app in the local Fixo catalog.",
    {
      id: z.string().optional(),
      label: z.string(),
      packageId: z.string(),
      localApkPath: z.string().optional(),
      githubRepo: z.string().optional(),
      apkUrl: z.string().optional(),
      play: z.boolean().optional(),
      pinned: z.boolean().optional(),
    },
    async (args) => {
      try {
        const app = await upsertCatalogApp({
          id: args.id ?? "",
          label: args.label,
          packageId: args.packageId,
          pinned: args.pinned,
          sources: {
            play: args.play ?? true,
            localApkPath: args.localApkPath,
            githubRepo: args.githubRepo,
            apkUrl: args.apkUrl,
          },
        });
        return jsonResult({ status: "ok", message: `Saved ${app.label}`, data: app });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "start_backup",
    "Start a controllable phone backup (media + contacts) and return a jobId for progress/pause/cancel.",
    { deviceSerial: z.string().optional() },
    async ({ deviceSerial }) => {
      try {
        const { serial, evidence } = await resolveSerial(adb, deviceSerial);
        const progress = backupJobs.start(adb, serial);
        return jsonResult({
          deviceSerial: serial,
          status: "started",
          message: "بک‌آپ شروع شد",
          data: progress,
          evidence,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    "provision_vpn",
    "Create a Pasargad VPN account and push the subscription into V2Box on the phone. Only days and gigabytes are required; username is auto-assigned as sequential numbers (1, 2, 3, …).",
    {
      days: z.number().positive(),
      gigabytes: z.number().positive(),
      deviceSerial: z.string().optional(),
      pushToDevice: z.boolean().optional(),
    },
    async (args) => {
      try {
        const { createPasargadClient, pushConfigToV2Box } = await import(
          "./pasargad.js"
        ).then(async (p) => ({
          createPasargadClient: p.createPasargadClient,
          pushConfigToV2Box: (await import("./v2box.js")).pushConfigToV2Box,
        }));
        const client = createPasargadClient();
        if (!client.hasCredentials) {
          return jsonResult(
            {
              status: "error",
              message:
                "PASARGAD_API_KEY در .env ست نشده است (یا PASARGAD_USERNAME/PASSWORD).",
            },
            false,
          );
        }
        const account = await client.provision({
          days: args.days,
          gigabytes: args.gigabytes,
        });
        let push = null;
        if (args.pushToDevice !== false) {
          const { serial, evidence } = await resolveSerial(adb, args.deviceSerial);
          const result = await pushConfigToV2Box(adb, serial, account.subscriptionUrl);
          push = { deviceSerial: serial, ...result, evidence: [...evidence, ...result.evidence] };
        }
        return jsonResult({
          status: "ok",
          message: push?.ok
            ? `${account.message} — ${push.message}`
            : push
              ? `${account.message}. وی‌توباکس: ${push.message}`
              : account.message,
          data: { account, push },
        });
      } catch (err) {
        const { PasargadError } = await import("./pasargad.js");
        if (err instanceof PasargadError) {
          return jsonResult(
            { status: "error", message: err.message, detail: err.detail },
            false,
          );
        }
        return fail(err);
      }
    },
  );

  server.tool(
    "delete_vpn",
    "Permanently delete a Pasargad VPN account by numeric username.",
    { username: z.string() },
    async ({ username }) => {
      try {
        const { createPasargadClient } = await import("./pasargad.js");
        const client = createPasargadClient();
        if (!client.hasCredentials) {
          return jsonResult(
            {
              status: "error",
              message:
                "PASARGAD_API_KEY در .env ست نشده است (یا PASARGAD_USERNAME/PASSWORD).",
            },
            false,
          );
        }
        const existing = await client.lookupUser(username);
        if (!existing) {
          return jsonResult(
            { status: "error", message: `اکانت ${username.trim()} پیدا نشد` },
            false,
          );
        }
        await client.deleteUser(existing.username);
        return jsonResult({
          status: "ok",
          message: `اکانت ${existing.username} پاک شد`,
          data: { username: existing.username },
        });
      } catch (err) {
        const { PasargadError } = await import("./pasargad.js");
        if (err instanceof PasargadError) {
          return jsonResult(
            { status: "error", message: err.message, detail: err.detail },
            false,
          );
        }
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
