import type { NetworkStatus } from "@fixo/shared";
import { AdbError, type AdbRunner, getprop, shell } from "./adb.js";

function parseBoolish(value: string | undefined): boolean | null {
  if (value === undefined) return null;
  const v = value.trim().toLowerCase();
  if (["1", "true", "on", "yes", "enabled"].includes(v)) return true;
  if (["0", "false", "off", "no", "disabled"].includes(v)) return false;
  return null;
}

export async function getNetworkStatus(
  adb: AdbRunner,
  serial: string,
): Promise<{ status: NetworkStatus; evidence: string[] }> {
  const evidence: string[] = [];

  const wifiCmd = await shell(adb, serial, "settings get global wifi_on");
  evidence.push(wifiCmd.evidence);
  let wifiEnabled = parseBoolish(wifiCmd.stdout);

  if (wifiEnabled === null) {
    const svc = await shell(adb, serial, "dumpsys wifi | grep -m1 'Wi-Fi is'");
    evidence.push(svc.evidence);
    if (/Wi-Fi is enabled/i.test(svc.stdout)) wifiEnabled = true;
    else if (/Wi-Fi is disabled/i.test(svc.stdout)) wifiEnabled = false;
  }

  const dataCmd = await shell(adb, serial, "settings get global mobile_data");
  evidence.push(dataCmd.evidence);
  let mobileDataEnabled = parseBoolish(dataCmd.stdout);
  if (mobileDataEnabled === null) {
    // Some devices store this under secure/global differently; soft-fail to null.
    mobileDataEnabled = null;
  }

  const airplaneCmd = await shell(
    adb,
    serial,
    "settings get global airplane_mode_on",
  );
  evidence.push(airplaneCmd.evidence);
  const airplaneMode = parseBoolish(airplaneCmd.stdout);

  let wifiConnected: boolean | null = null;
  const ipCmd = await shell(adb, serial, "dumpsys wifi | grep -m1 'mNetworkInfo'");
  evidence.push(ipCmd.evidence);
  if (/CONNECTED/i.test(ipCmd.stdout)) wifiConnected = true;
  else if (/DISCONNECTED|IDLE|SCANNING/i.test(ipCmd.stdout)) wifiConnected = false;

  let wifiSsid: string | null = null;
  const statusCmd = await shell(adb, serial, "cmd wifi status");
  evidence.push(statusCmd.evidence);
  const statusMatch = statusCmd.stdout.match(/Wifi is connected to "([^"]+)"/i);
  if (statusMatch?.[1] && statusMatch[1] !== "<unknown ssid>") {
    wifiSsid = statusMatch[1];
    wifiConnected = true;
  } else {
    const ssidCmd = await shell(
      adb,
      serial,
      "dumpsys wifi | grep -E 'SSID:' | head -n 8",
    );
    evidence.push(ssidCmd.evidence);
    const matches = [...ssidCmd.stdout.matchAll(/SSID:\s*"?([^,"\n]+)"?/gi)];
    for (const m of matches) {
      const candidate = m[1]?.trim();
      if (candidate && candidate !== "<unknown ssid>" && candidate !== "0x") {
        wifiSsid = candidate;
        break;
      }
    }
  }

  const manufacturer = (await getprop(adb, serial, "ro.product.manufacturer")) ?? null;

  return {
    status: {
      wifiEnabled,
      mobileDataEnabled,
      airplaneMode,
      wifiConnected,
      wifiSsid,
      manufacturer,
      raw: {
        wifi_on: wifiCmd.stdout.trim(),
        mobile_data: dataCmd.stdout.trim(),
        airplane_mode_on: airplaneCmd.stdout.trim(),
        wifi_status: statusCmd.stdout.trim().slice(0, 500),
      },
    },
    evidence,
  };
}

export async function setWifi(
  adb: AdbRunner,
  serial: string,
  enabled: boolean,
): Promise<{ evidence: string[] }> {
  const evidence: string[] = [];
  const cmd = enabled ? "svc wifi enable" : "svc wifi disable";
  const result = await shell(adb, serial, cmd);
  evidence.push(result.evidence);
  if (result.code !== 0 && result.stderr.trim()) {
    // Try alternate for newer Android
    const alt = await shell(
      adb,
      serial,
      `cmd wifi set-wifi-enabled ${enabled ? "enabled" : "disabled"}`,
    );
    evidence.push(alt.evidence);
  }
  return { evidence };
}

export async function setMobileData(
  adb: AdbRunner,
  serial: string,
  enabled: boolean,
): Promise<{ evidence: string[] }> {
  const evidence: string[] = [];
  const cmd = enabled ? "svc data enable" : "svc data disable";
  const result = await shell(adb, serial, cmd);
  evidence.push(result.evidence);

  // Verify / fallback via settings (may be ignored without elevated perms)
  if (result.code !== 0) {
    const fallback = await shell(
      adb,
      serial,
      `settings put global mobile_data ${enabled ? "1" : "0"}`,
    );
    evidence.push(fallback.evidence);
  }
  return { evidence };
}

export async function setAirplaneMode(
  adb: AdbRunner,
  serial: string,
  enabled: boolean,
): Promise<{ evidence: string[] }> {
  const evidence: string[] = [];
  const put = await shell(
    adb,
    serial,
    `settings put global airplane_mode_on ${enabled ? "1" : "0"}`,
  );
  evidence.push(put.evidence);

  const broadcast = await shell(
    adb,
    serial,
    `am broadcast -a android.intent.action.AIRPLANE_MODE --ez state ${enabled ? "true" : "false"}`,
  );
  evidence.push(broadcast.evidence);

  if (put.code !== 0) {
    throw new AdbError(
      "Failed to change airplane mode. Some OEM builds block this over ADB without root.",
      evidence,
    );
  }
  return { evidence };
}

export async function getDeviceInfo(adb: AdbRunner, serial: string) {
  const [model, manufacturer, androidVersion, sdk] = await Promise.all([
    getprop(adb, serial, "ro.product.model"),
    getprop(adb, serial, "ro.product.manufacturer"),
    getprop(adb, serial, "ro.build.version.release"),
    getprop(adb, serial, "ro.build.version.sdk"),
  ]);
  return { serial, model, manufacturer, androidVersion, sdk };
}

export function assertConfirmed(confirmed: boolean, action: string) {
  if (!confirmed) {
    throw new AdbError(
      `Confirmation required before ${action}. Ask the technician to confirm, then call again with confirmed=true.`,
    );
  }
}
