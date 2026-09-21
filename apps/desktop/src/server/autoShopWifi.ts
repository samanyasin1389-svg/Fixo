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
    | "idle"
    | "blocked"
    | "connecting"
    | "online"
    | "forgetting"
    | "done"
    | "error";
  message: string;
  updatedAt: string;
};

export type AutoStatus = {
  enabled: boolean;
  hasPassword: boolean;
  ssid: string;
  usbDevices: string[];
  sessions: AutoSession[];
  blocker: string | null;
};

type Logger = (line: string) => void;

export class ShopWifiAutoManager {
  private sessions = new Map<string, AutoSession>();
  private knownUsb = new Set<string>();
  private busy = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private log: Logger;
  private lastBlocker: string | null = null;

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

  async getStatus(): Promise<AutoStatus> {
    const settings = await loadSettings();
    let usbDevices: string[] = [];
    try {
      const devices = await listDevices(this.adb);
      usbDevices = devices
        .filter((d) => d.status === "device" && !d.serial.includes(":"))
        .map((d) => d.serial);
    } catch {
      usbDevices = [];
    }

    let blocker: string | null = null;
    if (settings.autoShopWifi === false) {
      blocker = "اتصال خودکار در تنظیمات خاموش است.";
    } else if (!settings.shopWifiPassword) {
      blocker = "رمز وای‌فای مغازه ذخیره نشده. در تنظیمات برنامه رمز nibero را ذخیره کن.";
    } else if (usbDevices.length === 0) {
      blocker = "هیچ دستگاه ADB آماده‌ای دیده نمی‌شود.";
    }

    this.lastBlocker = blocker;
    return {
      enabled: settings.autoShopWifi !== false,
      hasPassword: Boolean(settings.shopWifiPassword),
      ssid: settings.shopWifiSsid,
      usbDevices,
      sessions: this.getSessions(),
      blocker,
    };
  }

  /** Force re-run auto connect for all currently attached USB devices. */
  async forceRun(): Promise<AutoStatus> {
    const settings = await loadSettings();
    if (settings.autoShopWifi === false) {
      this.upsert("system", {
        ssid: settings.shopWifiSsid,
        phase: "blocked",
        message: "اتصال خودکار خاموش است.",
      });
      return this.getStatus();
    }
    if (!settings.shopWifiPassword) {
      this.upsert("system", {
        ssid: settings.shopWifiSsid,
        phase: "blocked",
        message: "رمز وای‌فای مغازه ذخیره نشده است.",
      });
      return this.getStatus();
    }

    const devices = await listDevices(this.adb);
    const usbReady = devices.filter(
      (d) => d.status === "device" && !d.serial.includes(":"),
    );
    for (const device of usbReady) {
      this.knownUsb.delete(device.serial);
      this.busy.delete(device.serial);
    }
    for (const device of usbReady) {
      this.knownUsb.add(device.serial);
      await this.onUsbAttach(
        device.serial,
        settings.shopWifiSsid,
        settings.shopWifiPassword,
      );
    }
    if (usbReady.length === 0) {
      this.upsert("system", {
        ssid: settings.shopWifiSsid,
        phase: "blocked",
        message: "ADB دستگاهی نمی‌بیند. adb devices را چک کن.",
      });
    }
    return this.getStatus();
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
      if (settings.autoShopWifi === false) {
        this.lastBlocker = "auto disabled";
        return;
      }
      if (!settings.shopWifiPassword) {
        this.lastBlocker = "missing password";
        // Visible in UI instead of silent skip
        this.upsert("system", {
          ssid: settings.shopWifiSsid,
          phase: "blocked",
          message:
            "رمز وای‌فای مغازه ذخیره نشده. SSID/رمز را در تنظیمات ذخیره کن تا اتصال خودکار شروع شود.",
        });
        return;
      }

      const devices = await listDevices(this.adb);
      const usbReady = devices.filter(
        (d) => d.status === "device" && !d.serial.includes(":"),
      );
      const usbSerials = new Set(usbReady.map((d) => d.serial));

      if (usbReady.length > 0 && this.sessions.get("system")?.phase === "blocked") {
        this.sessions.delete("system");
      }

      for (const device of usbReady) {
        if (this.knownUsb.has(device.serial)) continue;
        this.knownUsb.add(device.serial);
        void this.onUsbAttach(
          device.serial,
          settings.shopWifiSsid,
          settings.shopWifiPassword,
        );
      }

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
          ? `وصل به ${ssid} شد (strategy=${connected.strategy}) — آماده‌سازی ADB بی‌سیم`
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
          message: `به ${ssid} وصل شد، ولی ADB بی‌سیم فعال نشد. فراموشی بعد از قطع کابل ممکن است کار نکند: ${
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
          "کابل قطع شد ولی ADB بی‌سیم نداشتیم؛ فراموشی بعد از قطع ممکن نشد.",
      });
      return;
    }

    try {
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
