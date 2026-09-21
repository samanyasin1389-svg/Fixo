import { createOpenAI } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { z } from "zod";
import type { AdbRunner } from "@fixo/mcp-network";
import {
  AdbError,
  assertConfirmed,
  getDeviceInfo,
  getNetworkStatus,
  listDevices,
  resolveSerial,
  setAirplaneMode,
  setMobileData,
  setWifi,
} from "@fixo/mcp-network";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type PendingAction = {
  tool: "set_wifi" | "set_mobile_data" | "set_airplane_mode";
  enabled: boolean;
  deviceSerial?: string;
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
      description: "Read Wi-Fi, mobile data, and airplane mode status.",
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
        "Turn Wi-Fi on or off. Always call first with confirmed=false unless the technician already confirmed.",
      parameters: z.object({
        enabled: z.boolean(),
        confirmed: z.boolean().default(false),
        deviceSerial: z.string().optional(),
      }),
      execute: async ({ enabled, confirmed, deviceSerial }) => {
        const label = enabled ? "روشن کردن Wi-Fi" : "خاموش کردن Wi-Fi";
        const serialHint = deviceSerial ?? input.deviceSerial;
        if (!confirmed && !input.confirmAction) {
          pendingAction = {
            tool: "set_wifi",
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
        const change = await setWifi(input.adb, serial, enabled);
        await sleep(800);
        const after = await getNetworkStatus(input.adb, serial);
        return toolJson({
          ok: after.status.wifiEnabled === enabled || after.status.wifiEnabled === null,
          deviceSerial: serial,
          before: before.status,
          after: after.status,
          evidence: [...e0, ...before.evidence, ...change.evidence, ...after.evidence],
        });
      },
    }),
    set_mobile_data: tool({
      description:
        "Turn mobile data on or off. Requires technician confirmation (confirmed=true).",
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
      description:
        "Turn airplane mode on or off. Requires technician confirmation (confirmed=true).",
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
  };

  const system = `تو Fixo هستی؛ دستیار نرم‌افزاری تعمیرکار موبایل اندروید در مغازه تعمیرات.
فقط با ابزارهای موجود کار کن: list_devices, get_device_info, get_network_status, set_wifi, set_mobile_data, set_airplane_mode.
فاز فعلی فقط خاموش/روشن کردن اینترنت گوشی است (Wi-Fi، دیتای موبایل، حالت هواپیما).
قبل از هر تغییر شبکه، اول وضعیت را بخوان. برای تغییر، اول با confirmed=false صدا بزن تا تأیید تعمیرکار گرفته شود؛ بعد از تأیید با confirmed=true اجرا کن.
جواب‌ها را کوتاه و به فارسی بده. اگر دستگاه وصل نیست، واضح بگو.
اگر کاربر گفت «اینترنت را خاموش کن» معمولاً Wi-Fi و در صورت نیاز دیتا/هواپیما را مدیریت کن؛ از کاربر دقیق بپرس اگر مبهم بود.`;

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
          "تعمیرکار عملیات پیشنهادی را تأیید کرد. همان تغییر شبکه را الان با confirmed=true اجرا کن و نتیجه نهایی را بگو.",
      },
    ];
  }

  try {
    const result = await generateText({
      model: openai(modelName),
      system,
      messages,
      tools,
      maxSteps: 6,
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
