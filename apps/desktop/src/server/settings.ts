import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type FixoTheme = "night" | "day" | "galaxy";
export type FixoLocale = "fa" | "en";

export type FixoSettings = {
  shopWifiSsid: string;
  shopWifiPassword: string;
  openaiModel?: string;
  autoShopWifi?: boolean;
  theme?: FixoTheme;
  locale?: FixoLocale;
};

const DEFAULTS: FixoSettings = {
  shopWifiSsid: "nibero",
  shopWifiPassword: "",
  openaiModel: "gpt-4.1",
  autoShopWifi: false,
  theme: "night",
  locale: "fa",
};

function settingsPath() {
  return path.join(os.homedir(), ".config", "fixo", "settings.json");
}

function normalizeTheme(value: unknown): FixoTheme {
  if (value === "day" || value === "galaxy") return value;
  return "night";
}

function normalizeLocale(value: unknown): FixoLocale {
  return value === "en" ? "en" : "fa";
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
      autoShopWifi:
        typeof parsed.autoShopWifi === "boolean"
          ? parsed.autoShopWifi
          : process.env.AUTO_SHOP_WIFI === "1"
            ? true
            : DEFAULTS.autoShopWifi,
      theme: normalizeTheme(parsed.theme ?? DEFAULTS.theme),
      locale: normalizeLocale(parsed.locale ?? DEFAULTS.locale),
    };
  } catch {
    return {
      ...DEFAULTS,
      shopWifiSsid: process.env.SHOP_WIFI_SSID || DEFAULTS.shopWifiSsid,
      shopWifiPassword: process.env.SHOP_WIFI_PASSWORD || DEFAULTS.shopWifiPassword,
      autoShopWifi: process.env.AUTO_SHOP_WIFI === "1" ? true : DEFAULTS.autoShopWifi,
      theme: DEFAULTS.theme,
      locale: DEFAULTS.locale,
    };
  }
}

export async function saveSettings(patch: Partial<FixoSettings>): Promise<FixoSettings> {
  const current = await loadSettings();
  const next: FixoSettings = {
    ...current,
    ...patch,
    ...(patch.theme !== undefined ? { theme: normalizeTheme(patch.theme) } : {}),
    ...(patch.locale !== undefined ? { locale: normalizeLocale(patch.locale) } : {}),
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
    autoShopWifi: settings.autoShopWifi === true,
    theme: settings.theme ?? "night",
    locale: settings.locale ?? "fa",
  };
}
