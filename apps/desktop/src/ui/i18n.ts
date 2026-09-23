export type Locale = "fa" | "en";
export type Theme = "night" | "day";

export type MessageKey =
  | "tagline"
  | "connected"
  | "disconnected"
  | "themeNight"
  | "themeDay"
  | "langFa"
  | "langEn"
  | "networkShop"
  | "wifi"
  | "network"
  | "auto"
  | "onPlus"
  | "off"
  | "forgetShop"
  | "apps"
  | "installSelected"
  | "addApp"
  | "closeForm"
  | "saveCatalog"
  | "displayName"
  | "packageId"
  | "localApkOptional"
  | "githubOptional"
  | "apkUrlOptional"
  | "cancel"
  | "backupPhone"
  | "backupHint"
  | "startBackup"
  | "pause"
  | "resume"
  | "settingsWifi"
  | "closeSettings"
  | "ssid"
  | "passwordNew"
  | "passwordShop"
  | "save"
  | "chat"
  | "confirm"
  | "send"
  | "sending"
  | "chatPlaceholder"
  | "welcome"
  | "sourceModelSearch"
  | "sourceLocalApk"
  | "sourceGithub"
  | "sourceUrl"
  | "saved"
  | "needLabelPackage"
  | "searchOpened"
  | "backupStarted"
  | "devicesError"
  | "playFail"
  | "installedOk"
  | "manualInstall"
  | "manualInstallHint"
  | "runManual"
  | "installing";

const fa: Record<MessageKey, string> = {
  tagline: "میزکار تعمیرات؛ شبکه، نصب، بک‌آپ.",
  connected: "وصل",
  disconnected: "قطع",
  themeNight: "شب",
  themeDay: "روز",
  langFa: "فا",
  langEn: "EN",
  networkShop: "شبکه مغازه",
  wifi: "Wi‑Fi",
  network: "شبکه",
  auto: "خودکار",
  onPlus: "روشن +",
  off: "خاموش",
  forgetShop: "فراموش مغازه",
  apps: "برنامه‌ها",
  installSelected: "نصب از پلی",
  addApp: "افزودن برنامه",
  closeForm: "بستن فرم",
  saveCatalog: "ذخیره در کاتالوگ",
  displayName: "نام نمایشی (مثلاً اسنپ)",
  packageId: "packageId (مثلاً cab.snapp.passenger)",
  localApkOptional: "مسیر APK محلی (اختیاری)",
  githubOptional: "گیت‌هاب owner/repo (اختیاری)",
  apkUrlOptional: "لینک مستقیم APK (اختیاری)",
  cancel: "لغو",
  backupPhone: "بک‌آپ گوشی",
  backupHint: "عکس، فیلم و مخاطبین → Desktop/Fixo-Backups",
  startBackup: "شروع بک‌آپ",
  pause: "توقف موقت",
  resume: "ادامه",
  settingsWifi: "تنظیمات رمز وای‌فای",
  closeSettings: "بستن تنظیمات",
  ssid: "SSID",
  passwordNew: "رمز جدید (اختیاری)",
  passwordShop: "رمز وای‌فای مغازه",
  save: "ذخیره",
  chat: "گفتگو",
  confirm: "تأیید",
  send: "ارسال",
  sending: "...",
  chatPlaceholder: "مثلاً: وای‌فای را روشن کن / تلگرام نصب کن",
  welcome: "سلام. وای‌فای، نصب از پلی، یا بک‌آپ را بگو.",
  sourceModelSearch: "جستجوی مدل‌محور",
  sourceLocalApk: "فایل APK روی لپ‌تاپ",
  sourceGithub: "گیت‌هاب",
  sourceUrl: "لینک مستقیم",
  saved: "ذخیره شد.",
  needLabelPackage: "نام و packageId لازم است",
  searchOpened: "جستجو باز شد — APK را دانلود کنید",
  backupStarted: "بک‌آپ شروع شد",
  devicesError: "خطا در خواندن دستگاه‌ها",
  playFail: "از پلی نصب نشد. از نصب دستی گزینه‌های دیگر را امتحان کن.",
  installedOk: "نصب شد",
  manualInstall: "نصب دستی",
  manualInstallHint: "اگر پلی جواب نداد، یکی از این‌ها را بزن.",
  runManual: "اجرا",
  installing: "در حال نصب…",
};

const en: Record<MessageKey, string> = {
  tagline: "Repair bench — network, install, backup.",
  connected: "Connected",
  disconnected: "Disconnected",
  themeNight: "Night",
  themeDay: "Day",
  langFa: "FA",
  langEn: "EN",
  networkShop: "Shop network",
  wifi: "Wi‑Fi",
  network: "Network",
  auto: "Auto",
  onPlus: "On +",
  off: "Off",
  forgetShop: "Forget shop Wi‑Fi",
  apps: "Apps",
  installSelected: "Install from Play",
  addApp: "Add app",
  closeForm: "Close form",
  saveCatalog: "Save to catalog",
  displayName: "Display name (e.g. Snapp)",
  packageId: "packageId (e.g. cab.snapp.passenger)",
  localApkOptional: "Local APK path (optional)",
  githubOptional: "GitHub owner/repo (optional)",
  apkUrlOptional: "Direct APK URL (optional)",
  cancel: "Cancel",
  backupPhone: "Phone backup",
  backupHint: "Photos, videos, contacts → Desktop/Fixo-Backups",
  startBackup: "Start backup",
  pause: "Pause",
  resume: "Resume",
  settingsWifi: "Wi‑Fi password settings",
  closeSettings: "Close settings",
  ssid: "SSID",
  passwordNew: "New password (optional)",
  passwordShop: "Shop Wi‑Fi password",
  save: "Save",
  chat: "Chat",
  confirm: "Confirm",
  send: "Send",
  sending: "...",
  chatPlaceholder: "e.g. turn Wi‑Fi on / install Telegram",
  welcome: "Hi. Ask for shop Wi‑Fi, Play install, or a backup.",
  sourceModelSearch: "Model search",
  sourceLocalApk: "Local APK on laptop",
  sourceGithub: "GitHub",
  sourceUrl: "Direct link",
  saved: "Saved.",
  needLabelPackage: "Label and packageId are required",
  searchOpened: "Search opened — download the APK",
  backupStarted: "Backup started",
  devicesError: "Could not read devices",
  playFail: "Play install failed. Try other options under Manual install.",
  installedOk: "Installed",
  manualInstall: "Manual install",
  manualInstallHint: "If Play failed, pick one of these.",
  runManual: "Run",
  installing: "Installing…",
};

const tables: Record<Locale, Record<MessageKey, string>> = { fa, en };

export function t(locale: Locale, key: MessageKey): string {
  return tables[locale][key] ?? tables.fa[key] ?? key;
}

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "fa" ? "rtl" : "ltr";
}

export function sourceLabel(locale: Locale, id: string): string {
  switch (id) {
    case "model_search":
      return t(locale, "sourceModelSearch");
    case "local_apk":
      return t(locale, "sourceLocalApk");
    case "github":
      return t(locale, "sourceGithub");
    case "url":
      return t(locale, "sourceUrl");
    default:
      return id;
  }
}

/** Manual-only sources (no Play, no auto cascade) */
export const MANUAL_SOURCE_IDS = [
  "model_search",
  "local_apk",
  "github",
  "url",
] as const;
