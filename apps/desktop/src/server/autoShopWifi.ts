import {
  connectWifi,
  disconnectWirelessAdb,
  enableWirelessAdb,
  forgetWifi,
  listDevices,
  type AdbRunner,
} from "@fixo/mcp-network";
import { loadSettings } from "./settings.js";

export type AutoSession = {
  usbSerial: string;
  wirelessSerial?: string;
  ssid: string;
  phase:
    | "connecting"
    | "online"
    | "forgetting"
    | "done"
    | "error";
  message: string;
  updatedAt: string;
};

type Logger = (line: string) => void;

export class ShopWifiAutoManager {
  private sessions = new Map<string, AutoSession>();
  private knownUsb = new Set<string>();
  private busy = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private log: Logger;

  constructor(
    private adb: AdbRunner,
    log: Logger = console.log,
  ) {
    this.log = log;
  }

  start(intervalMs = 2000) {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    void this.tick();
    this.log("[auto-wifi] watcher started");
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getSessions(): AutoSession[] {
    return [...this.sessions.values()].sort((a, b) =>
      a.updatedAt < b.updatedAt ? 1 : -1,
    );
  }

  private upsert(
    serial: string,
    patch: Partial<AutoSession> & Pick<AutoSession, "phase" | "message" | "ssid">,
  ) {
    const prev = this.sessions.get(serial);
    const next: AutoSession = {
      usbSerial: serial,
      wirelessSerial: patch.wirelessSerial ?? prev?.wirelessSerial,
      ssid: patch.ssid,
      phase: patch.phase,
      message: patch.message,
      updatedAt: new Date().toISOString(),
    };
    this.sessions.set(serial, next);
  }

  private async tick() {
    try {
      const settings = await loadSettings();
      if (settings.autoShopWifi === false) return;
      if (!settings.shopWifiPassword) {
        return;
      }

      const devices = await listDevices(this.adb);
      const usbReady = devices.filter(
        (d) => d.status === "device" && !d.serial.includes(":"),
      );
      const usbSerials = new Set(usbReady.map((d) => d.serial));

      // New USB attachments
      for (const device of usbReady) {
        if (this.knownUsb.has(device.serial)) continue;
        this.knownUsb.add(device.serial);
        void this.onUsbAttach(device.serial, settings.shopWifiSsid, settings.shopWifiPassword);
      }

      // USB removals → forget via wireless if possible
      for (const serial of [...this.knownUsb]) {
        if (usbSerials.has(serial)) continue;
        this.knownUsb.delete(serial);
        void this.onUsbDetach(serial, settings.shopWifiSsid);
      }
    } catch (err) {
      this.log(
        `[auto-wifi] tick error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async onUsbAttach(serial: string, ssid: string, password: string) {
    if (this.busy.has(serial)) return;
    this.busy.add(serial);
    this.upsert(serial, {
      ssid,
      phase: "connecting",
      message: `دستگاه وصل شد — در حال روشن کردن Wi‑Fi و وصل به ${ssid}`,
    });
    this.log(`[auto-wifi] attach ${serial}`);

    try {
      const connected = await connectWifi(this.adb, serial, ssid, password);
      this.upsert(serial, {
        ssid,
        phase: "connecting",
        message: connected.connected
          ? `وصل به ${ssid} شد — در حال آماده‌سازی ADB بی‌سیم برای فراموشی بعد از قطع کابل`
          : `تلاش اتصال به ${ssid} انجام شد`,
      });

      try {
        const wireless = await enableWirelessAdb(this.adb, serial);
        this.upsert(serial, {
          ssid,
          phase: "online",
          wirelessSerial: wireless.wirelessSerial,
          message: `آنلاین روی ${ssid}. با قطع کابل، شبکه خودکار فراموش می‌شود (${wireless.wirelessSerial})`,
        });
        this.log(`[auto-wifi] wireless ready ${serial} -> ${wireless.wirelessSerial}`);
      } catch (err) {
        this.upsert(serial, {
          ssid,
          phase: "online",
          message: `به ${ssid} وصل شد، ولی ADB بی‌سیم فعال نشد. با قطع کابل ممکن است فراموشی خودکار ممکن نباشد: ${
            err instanceof Error ? err.message : String(err)
          }`,
        });
      }
    } catch (err) {
      this.upsert(serial, {
        ssid,
        phase: "error",
        message: `اتصال خودکار ناموفق: ${err instanceof Error ? err.message : String(err)}`,
      });
      this.log(`[auto-wifi] attach failed ${serial}: ${err}`);
      // allow retry on later ticks (e.g. after password is saved)
      this.knownUsb.delete(serial);
    } finally {
      this.busy.delete(serial);
    }
  }

  private async onUsbDetach(usbSerial: string, ssid: string) {
    const session = this.sessions.get(usbSerial);
    if (!session) return;
    if (session.phase === "forgetting" || session.phase === "done") return;

    this.upsert(usbSerial, {
      ssid,
      phase: "forgetting",
      message: "کابل قطع شد — در حال فراموش کردن وای‌فای مغازه",
      wirelessSerial: session.wirelessSerial,
    });
    this.log(`[auto-wifi] detach ${usbSerial}`);

    const targetSerial = session.wirelessSerial;
    if (!targetSerial) {
      this.upsert(usbSerial, {
        ssid,
        phase: "error",
        message:
          "کابل قطع شد ولی ADB بی‌سیم نداشتیم؛ نمی‌شود بعد از قطع کابل شبکه را فراموش کرد. دفعه بعد گوشی را تا تکمیل اتصال نگه دارید.",
      });
      return;
    }

    try {
      // Give wireless link a moment after USB unplug
      await sleep(1500);
      await forgetWifi(this.adb, targetSerial, ssid);
      await disconnectWirelessAdb(this.adb, targetSerial);
      this.upsert(usbSerial, {
        ssid,
        phase: "done",
        wirelessSerial: targetSerial,
        message: `کابل قطع شد و شبکه ${ssid} فراموش شد.`,
      });
      this.log(`[auto-wifi] forgot ${ssid} via ${targetSerial}`);
    } catch (err) {
      this.upsert(usbSerial, {
        ssid,
        phase: "error",
        wirelessSerial: targetSerial,
        message: `قطع کابل ثبت شد ولی فراموشی شبکه شکست خورد: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
      this.log(`[auto-wifi] forget failed: ${err}`);
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
