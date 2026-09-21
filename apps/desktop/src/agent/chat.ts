import { createOpenAI } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { z } from "zod";
import type { AdbRunner } from "@fixo/mcp-network";
import {
  AdbError,
  assertConfirmed,
  connectWifi,
  forgetWifi,
  getDeviceInfo,
  getNetworkStatus,
  listDevices,
  resolveSerial,
  setAirplaneMode,
  setMobileData,
  setWifi,
} from "@fixo/mcp-network";
import {
  backupJobs,
  checkAppInstalled,
  installAppCascade,
  installFromPlay,
  listCatalogApps,
  openPlayListing,
  resolvePackageId,
  upsertCatalogApp,
} from "@fixo/mcp-apps";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type PendingAction = {
  tool:
    | "set_wifi"
    | "set_mobile_data"
    | "set_airplane_mode"
    | "connect_shop_wifi"
    | "forget_shop_wifi";
  enabled?: boolean;
  deviceSerial?: string;
  packageId?: string;
  label: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function toolJson(payload: unknown) {
  return JSON.stringify(payload, null, 2);
}

export async function handleChat(input: {
  messages: ChatMessage[];
  deviceSerial?: string;
  confirmAction?: boolean;
  adb: AdbRunner;
  shopWifi: { ssid: string; password: string };
}) {
  const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const modelName = process.env.OPENAI_MODEL ?? "gpt-4.1";

  let pendingAction: PendingAction | null = null;

  const tools = {
    list_devices: tool({
      description: "List Android devices connected over ADB.",
      parameters: z.object({}),
      execute: async () => {
        const devices = await listDevices(input.adb);
        return toolJson({ ok: true, devices });
      },
    }),
    get_device_info: tool({
      description: "Get phone model and Android version.",
      parameters: z.object({
        deviceSerial: z.string().optional(),
      }),
      execute: async ({ deviceSerial }) => {
        const { serial, evidence } = await resolveSerial(
          input.adb,
          deviceSerial ?? input.deviceSerial,
        );
        const info = await getDeviceInfo(input.adb, serial);
        return toolJson({ ok: true, ...info, evidence });
      },
    }),
    get_network_status: tool({
      description: "Read Wi-Fi, mobile data, airplane mode, and current SSID.",
      parameters: z.object({
        deviceSerial: z.string().optional(),
      }),
      execute: async ({ deviceSerial }) => {
        const { serial } = await resolveSerial(
          input.adb,
          deviceSerial ?? input.deviceSerial,
        );
        const { status, evidence } = await getNetworkStatus(input.adb, serial);
        return toolJson({ ok: true, deviceSerial: serial, status, evidence });
      },
    }),
    set_wifi: tool({
      description:
        "Turn Wi-Fi on or off. When enabling, also connects to shop Wi-Fi (nibero). When user asks to turn Wi-Fi on, call with confirmed=true.",
      parameters: z.object({
        enabled: z.boolean(),
        confirmed: z.boolean().default(false),
        deviceSerial: z.string().optional(),
      }),
      execute: async ({ enabled, confirmed, deviceSerial }) => {
        const label = enabled
          ? `روشن کردن Wi-Fi و وصل به ${input.shopWifi.ssid}`
          : "خاموش کردن Wi-Fi";
        const serialHint = deviceSerial ?? input.deviceSerial;
        if (!confirmed && !input.confirmAction) {
          pendingAction = { tool: "set_wifi", enabled, deviceSerial: serialHint, label };
          return toolJson({
            ok: false,
            status: "needs_confirmation",
            message: `Confirmation required: ${label}`,
            pendingAction,
          });
        }
        assertConfirmed(true, label);
        const { serial, evidence: e0 } = await resolveSerial(input.adb, serialHint);
        const before = await getNetworkStatus(input.adb, serial);

        if (enabled) {
          if (!input.shopWifi.password) {
            return toolJson({
              ok: false,
              status: "missing_password",
              message: "رمز وای‌فای مغازه در تنظیمات ست نشده است.",
            });
          }
          const result = await connectWifi(
            input.adb,
            serial,
            input.shopWifi.ssid,
            input.shopWifi.password,
          );
          const after = await getNetworkStatus(input.adb, serial);
          return toolJson({
            ok: result.connected,
            deviceSerial: serial,
            strategy: result.strategy,
            before: before.status,
            after: after.status,
            message: result.connected
              ? `Wi-Fi on and connected to ${result.wifiSsid ?? input.shopWifi.ssid}`
              : `Wi-Fi enable/connect attempted to ${input.shopWifi.ssid}`,
            evidence: [...e0, ...before.evidence, ...result.evidence, ...after.evidence],
          });
        }

        const change = await setWifi(input.adb, serial, false);
        await sleep(800);
        const after = await getNetworkStatus(input.adb, serial);
        return toolJson({
          ok: after.status.wifiEnabled === false || after.status.wifiEnabled === null,
          deviceSerial: serial,
          before: before.status,
          after: after.status,
          evidence: [...e0, ...before.evidence, ...change.evidence, ...after.evidence],
        });
      },
    }),
    set_mobile_data: tool({
      description: "Turn mobile data on or off. Requires confirmation.",
      parameters: z.object({
        enabled: z.boolean(),
        confirmed: z.boolean().default(false),
        deviceSerial: z.string().optional(),
      }),
      execute: async ({ enabled, confirmed, deviceSerial }) => {
        const label = enabled ? "روشن کردن اینترنت موبایل" : "خاموش کردن اینترنت موبایل";
        const serialHint = deviceSerial ?? input.deviceSerial;
        if (!confirmed && !input.confirmAction) {
          pendingAction = {
            tool: "set_mobile_data",
            enabled,
            deviceSerial: serialHint,
            label,
          };
          return toolJson({
            ok: false,
            status: "needs_confirmation",
            message: `Confirmation required: ${label}`,
            pendingAction,
          });
        }
        assertConfirmed(true, label);
        const { serial, evidence: e0 } = await resolveSerial(input.adb, serialHint);
        const before = await getNetworkStatus(input.adb, serial);
        const change = await setMobileData(input.adb, serial, enabled);
        await sleep(800);
        const after = await getNetworkStatus(input.adb, serial);
        return toolJson({
          ok: true,
          deviceSerial: serial,
          before: before.status,
          after: after.status,
          evidence: [...e0, ...before.evidence, ...change.evidence, ...after.evidence],
        });
      },
    }),
    set_airplane_mode: tool({
      description: "Turn airplane mode on or off. Requires confirmation.",
      parameters: z.object({
        enabled: z.boolean(),
        confirmed: z.boolean().default(false),
        deviceSerial: z.string().optional(),
      }),
      execute: async ({ enabled, confirmed, deviceSerial }) => {
        const label = enabled ? "روشن کردن حالت هواپیما" : "خاموش کردن حالت هواپیما";
        const serialHint = deviceSerial ?? input.deviceSerial;
        if (!confirmed && !input.confirmAction) {
          pendingAction = {
            tool: "set_airplane_mode",
            enabled,
            deviceSerial: serialHint,
            label,
          };
          return toolJson({
            ok: false,
            status: "needs_confirmation",
            message: `Confirmation required: ${label}`,
            pendingAction,
          });
        }
        assertConfirmed(true, label);
        const { serial, evidence: e0 } = await resolveSerial(input.adb, serialHint);
        const before = await getNetworkStatus(input.adb, serial);
        const change = await setAirplaneMode(input.adb, serial, enabled);
        await sleep(1000);
        const after = await getNetworkStatus(input.adb, serial);
        return toolJson({
          ok: true,
          deviceSerial: serial,
          before: before.status,
          after: after.status,
          evidence: [...e0, ...before.evidence, ...change.evidence, ...after.evidence],
        });
      },
    }),
    connect_shop_wifi: tool({
      description: `Connect phone to shop Wi-Fi (${input.shopWifi.ssid}). Use when technician asks to connect to shop/company/nibero Wi-Fi. Requires confirmation.`,
      parameters: z.object({
        confirmed: z.boolean().default(false),
        deviceSerial: z.string().optional(),
      }),
      execute: async ({ confirmed, deviceSerial }) => {
        const label = `وصل به وای‌فای مغازه (${input.shopWifi.ssid})`;
        const serialHint = deviceSerial ?? input.deviceSerial;
        if (!input.shopWifi.password) {
          return toolJson({
            ok: false,
            status: "missing_password",
            message: "رمز وای‌فای مغازه در تنظیمات برنامه ست نشده است.",
          });
        }
        if (!confirmed && !input.confirmAction) {
          pendingAction = { tool: "connect_shop_wifi", deviceSerial: serialHint, label };
          return toolJson({
            ok: false,
            status: "needs_confirmation",
            message: `Confirmation required: ${label}`,
            pendingAction,
          });
        }
        assertConfirmed(true, label);
        const { serial, evidence: e0 } = await resolveSerial(input.adb, serialHint);
        const before = await getNetworkStatus(input.adb, serial);
        const result = await connectWifi(
          input.adb,
          serial,
          input.shopWifi.ssid,
          input.shopWifi.password,
        );
        const after = await getNetworkStatus(input.adb, serial);
        return toolJson({
          ok: result.connected,
          deviceSerial: serial,
          strategy: result.strategy,
          before: before.status,
          after: after.status,
          evidence: [...e0, ...before.evidence, ...result.evidence, ...after.evidence],
        });
      },
    }),
    forget_shop_wifi: tool({
      description: `Forget shop Wi-Fi (${input.shopWifi.ssid}) so the customer cannot keep using the shop network. Requires confirmation.`,
      parameters: z.object({
        confirmed: z.boolean().default(false),
        deviceSerial: z.string().optional(),
      }),
      execute: async ({ confirmed, deviceSerial }) => {
        const label = `فراموش کردن وای‌فای مغازه (${input.shopWifi.ssid})`;
        const serialHint = deviceSerial ?? input.deviceSerial;
        if (!confirmed && !input.confirmAction) {
          pendingAction = { tool: "forget_shop_wifi", deviceSerial: serialHint, label };
          return toolJson({
            ok: false,
            status: "needs_confirmation",
            message: `Confirmation required: ${label}`,
            pendingAction,
          });
        }
        assertConfirmed(true, label);
        const { serial, evidence: e0 } = await resolveSerial(input.adb, serialHint);
        const before = await getNetworkStatus(input.adb, serial);
        const result = await forgetWifi(input.adb, serial, input.shopWifi.ssid);
        const after = await getNetworkStatus(input.adb, serial);
        return toolJson({
          ok: result.forgotten,
          deviceSerial: serial,
          strategy: result.strategy,
          before: before.status,
          after: after.status,
          evidence: [...e0, ...before.evidence, ...result.evidence, ...after.evidence],
        });
      },
    }),
    check_app_installed: tool({
      description: "Check if an app/package is installed.",
      parameters: z.object({
        packageId: z.string().describe("packageId or alias like whatsapp"),
        deviceSerial: z.string().optional(),
      }),
      execute: async ({ packageId, deviceSerial }) => {
        const resolved = resolvePackageId(packageId);
        const { serial, evidence } = await resolveSerial(
          input.adb,
          deviceSerial ?? input.deviceSerial,
        );
        const check = await checkAppInstalled(input.adb, serial, resolved.packageId);
        return toolJson({
          ok: true,
          deviceSerial: serial,
          packageId: resolved.packageId,
          ...check,
          evidence,
        });
      },
    }),
    list_catalog_apps: tool({
      description: "List apps in the local Fixo catalog.",
      parameters: z.object({}),
      execute: async () => {
        const apps = await listCatalogApps();
        return toolJson({ ok: true, apps });
      },
    }),
    add_catalog_app: tool({
      description: "Add or update an app in the local catalog (label, packageId, optional APK/GitHub/URL).",
      parameters: z.object({
        label: z.string(),
        packageId: z.string(),
        localApkPath: z.string().optional(),
        githubRepo: z.string().optional(),
        apkUrl: z.string().optional(),
        play: z.boolean().optional(),
      }),
      execute: async (args) => {
        const app = await upsertCatalogApp({
          id: "",
          label: args.label,
          packageId: args.packageId,
          sources: {
            play: args.play ?? true,
            localApkPath: args.localApkPath,
            githubRepo: args.githubRepo,
            apkUrl: args.apkUrl,
          },
        });
        return toolJson({ ok: true, app, message: `${app.label} ذخیره شد` });
      },
    }),
    open_play_listing: tool({
      description: "Open Google Play listing for an app on the phone.",
      parameters: z.object({
        packageId: z.string(),
        deviceSerial: z.string().optional(),
      }),
      execute: async ({ packageId, deviceSerial }) => {
        const { serial, evidence } = await resolveSerial(
          input.adb,
          deviceSerial ?? input.deviceSerial,
        );
        const opened = await openPlayListing(input.adb, serial, packageId);
        return toolJson({
          ok: true,
          deviceSerial: serial,
          ...opened,
          evidence: [...evidence, ...opened.evidence],
        });
      },
    }),
    install_from_play: tool({
      description:
        "Install only from Google Play (no cascade). Prefer install_app for normal shop installs.",
      parameters: z.object({
        packageId: z.string().describe("e.g. com.whatsapp or whatsapp"),
        deviceSerial: z.string().optional(),
      }),
      execute: async ({ packageId, deviceSerial }) => {
        const resolved = resolvePackageId(packageId);
        const serialHint = deviceSerial ?? input.deviceSerial;
        const { serial, evidence } = await resolveSerial(input.adb, serialHint);
        const result = await installFromPlay(input.adb, serial, resolved.packageId);
        return toolJson({
          ok: result.installed,
          deviceSerial: serial,
          ...result,
          evidence: [...evidence, ...result.evidence],
        });
      },
    }),
    install_app: tool({
      description:
        "Install an app with cascade (Play → local APK → GitHub → URL). Use source=auto unless technician named a source. No Fixo confirmation after they chose source in UI; when chatting, default source=auto. Ask verbally if Play account is ready only if unclear.",
      parameters: z.object({
        packageId: z.string(),
        source: z.enum(["auto", "play", "local_apk", "github", "url"]).default("auto"),
        fallback: z.boolean().default(true),
        localApkPath: z.string().optional(),
        githubRepo: z.string().optional(),
        apkUrl: z.string().optional(),
        deviceSerial: z.string().optional(),
      }),
      execute: async (args) => {
        const resolved = resolvePackageId(args.packageId);
        const { serial, evidence } = await resolveSerial(
          input.adb,
          args.deviceSerial ?? input.deviceSerial,
        );
        const result = await installAppCascade(input.adb, serial, resolved.packageId, {
          source: args.source,
          fallback: args.fallback,
          localApkPath: args.localApkPath,
          githubRepo: args.githubRepo,
          apkUrl: args.apkUrl,
        });
        return toolJson({
          ok: result.installed,
          deviceSerial: serial,
          ...result,
          evidence: [...evidence, ...result.evidence],
          message: result.installed
            ? `${result.packageId} از ${result.usedSource} نصب شد`
            : `نصب ${result.packageId} کامل نشد`,
        });
      },
    }),
    backup_phone: tool({
      description:
        "Start phone backup (photos/videos/contacts) as a job. Returns jobId; progress continues in background.",
      parameters: z.object({
        deviceSerial: z.string().optional(),
      }),
      execute: async ({ deviceSerial }) => {
        const { serial, evidence } = await resolveSerial(
          input.adb,
          deviceSerial ?? input.deviceSerial,
        );
        const job = backupJobs.start(input.adb, serial);
        return toolJson({
          ok: true,
          deviceSerial: serial,
          job,
          evidence,
          message: `بک‌آپ شروع شد (${job.jobId})`,
        });
      },
    }),
    backup_control: tool({
      description: "Pause, resume, cancel, or read status of a backup job.",
      parameters: z.object({
        jobId: z.string(),
        action: z.enum(["status", "pause", "resume", "cancel"]),
      }),
      execute: async ({ jobId, action }) => {
        let job =
          action === "pause"
            ? backupJobs.pause(jobId)
            : action === "resume"
              ? backupJobs.resume(jobId)
              : action === "cancel"
                ? backupJobs.cancel(jobId)
                : backupJobs.get(jobId);
        if (!job) return toolJson({ ok: false, message: "job پیدا نشد" });
        return toolJson({ ok: true, job });
      },
    }),
  };

  const system = `تو Fixo هستی؛ دستیار نرم‌افزاری تعمیرکار موبایل اندروید در مغازه.
مثل یک نفر پشت پیشخوان حرف بزن: کوتاه، فارسی، بدون تعارف الکی و بدون ایموجی.
ابزارها: list_devices, get_device_info, get_network_status, set_wifi, set_mobile_data, set_airplane_mode, connect_shop_wifi, forget_shop_wifi, check_app_installed, list_catalog_apps, add_catalog_app, open_play_listing, install_from_play, install_app, backup_phone, backup_control.
مهم: وقتی کاربر گفت Wi-Fi / وای‌فای را روشن کن، از set_wifi با enabled=true استفاده کن؛ به وای‌فای مغازه (${input.shopWifi.ssid}) هم وصل می‌شود.
اگر گفت اپی را نصب کن: اگر منبع نگفت از install_app با source=auto و fallback=true استفاده کن (Play→APK محلی→GitHub→URL). اگر گفت فقط پلی / فقط APK / از گیت‌هاب، همان source را بگذار و fallback را روشن بگذار مگر صریحاً بگوید فقط همان.
قبل از نصب اگر معلوم نیست، یک جمله بپرس: «اکانت پلی آماده‌ست؟» — بعد نصب را اجرا کن؛ تأیید اضافی Fixo لازم نیست.
اگر گفت بک‌آپ بگیر، backup_phone را بزن. برای توقف/ادامه/لغو از backup_control.
جواب کوتاه و فارسی. رمز وای‌فای را هیچ‌وقت ننویس.`;

  let messages = input.messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  if (input.confirmAction) {
    messages = [
      ...messages,
      {
        role: "user" as const,
        content:
          "تعمیرکار عملیات پیشنهادی را تأیید کرد. همان کار را الان با confirmed=true اجرا کن و نتیجه نهایی را بگو.",
      },
    ];
  }

  try {
    const result = await generateText({
      model: openai(modelName),
      system,
      messages,
      tools,
      maxSteps: 8,
    });

    return {
      reply: result.text || "انجام شد.",
      pendingAction,
      toolCalls: result.steps?.flatMap((s) => s.toolCalls ?? []) ?? [],
    };
  } catch (err) {
    if (err instanceof AdbError) {
      return {
        reply: `خطای دستگاه: ${err.message}`,
        pendingAction,
        evidence: err.evidence,
      };
    }
    throw err;
  }
}
