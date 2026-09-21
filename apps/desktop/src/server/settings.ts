import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type FixoSettings = {
  shopWifiSsid: string;
  shopWifiPassword: string;
  openaiModel?: string;
};

const DEFAULTS: FixoSettings = {
  shopWifiSsid: "nibero",
  shopWifiPassword: "",
  openaiModel: "gpt-4.1",
};

function settingsPath() {
  return path.join(os.homedir(), ".config", "fixo", "settings.json");
}

export async function loadSettings(): Promise<FixoSettings> {
  const file = settingsPath();
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<FixoSettings>;
    return {
      ...DEFAULTS,
      ...parsed,
      shopWifiSsid: parsed.shopWifiSsid || process.env.SHOP_WIFI_SSID || DEFAULTS.shopWifiSsid,
      shopWifiPassword:
        parsed.shopWifiPassword ||
        process.env.SHOP_WIFI_PASSWORD ||
        DEFAULTS.shopWifiPassword,
    };
  } catch {
    return {
      ...DEFAULTS,
      shopWifiSsid: process.env.SHOP_WIFI_SSID || DEFAULTS.shopWifiSsid,
      shopWifiPassword: process.env.SHOP_WIFI_PASSWORD || DEFAULTS.shopWifiPassword,
    };
  }
}

export async function saveSettings(patch: Partial<FixoSettings>): Promise<FixoSettings> {
  const current = await loadSettings();
  const next: FixoSettings = {
    ...current,
    ...patch,
  };
  const file = settingsPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function publicSettings(settings: FixoSettings) {
  return {
    shopWifiSsid: settings.shopWifiSsid,
    hasShopWifiPassword: Boolean(settings.shopWifiPassword),
    openaiModel: settings.openaiModel,
  };
}
