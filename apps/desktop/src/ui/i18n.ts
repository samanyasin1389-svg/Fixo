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
  | "playAsk"
  | "yes"
  | "no"
  | "whereInstall"
  | "withoutPlay"
  | "startInstall"
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
  | "sourceAuto"
  | "sourcePlay"
  | "sourceModelSearch"
  | "sourceLocalApk"
  | "sourceGithub"
  | "sourceUrl"
  | "saved"
  | "installCancelled"
  | "needLabelPackage"
  | "searchOpened"
  | "backupStarted"
  | "devicesError";

const fa: Record<MessageKey, string> = {
  tagline: "همراه تعمیرکار؛ شبکه مغازه، نصب اپ و بک‌آپ گوشی مشتری.",
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
  installSelected: "نصب انتخاب‌شده‌ها",
  addApp: "افزودن برنامه",
  closeForm: "بستن فرم",
  saveCatalog: "ذخیره در کاتالوگ",
  displayName: "نام نمایشی (مثلاً اسنپ)",
  packageId: "packageId (مثلاً cab.snapp.passenger)",
  localApkOptional: "مسیر APK محلی (اختیاری)",
  githubOptional: "گیت‌هاب owner/repo (اختیاری)",
  apkUrlOptional: "لینک مستقیم APK (اختیاری)",
  playAsk: "اکانت پلی روی گوشی آماده‌ست؟",
  yes: "بله",
  no: "خیر",
  whereInstall: "از کجا نصب کنم؟",
  withoutPlay: "(بدون گوگل پلی)",
  startInstall: "شروع نصب",
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
  welcome: "سلام. وای‌فای مغازه، نصب برنامه، یا بک‌آپ گوشی را بگو.",
  sourceAuto: "خودکار (پیشنهادی)",
  sourcePlay: "گوگل پلی",
  sourceModelSearch: "جستجوی مدل‌محور",
  sourceLocalApk: "فایل APK روی لپ‌تاپ",
  sourceGithub: "گیت‌هاب",
  sourceUrl: "لینک مستقیم",
  saved: "ذخیره شد.",
  installCancelled: "نصب لغو شد.",
  needLabelPackage: "نام و packageId لازم است",
  searchOpened: "جستجو باز شد — APK را دانلود کنید",
  backupStarted: "بک‌آپ شروع شد",
  devicesError: "خطا در خواندن دستگاه‌ها",
};

const en: Record<MessageKey, string> = {
  tagline: "Built for repair techs — shop Wi‑Fi, app installs, and customer phone backups.",
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
  installSelected: "Install selected",
  addApp: "Add app",
  closeForm: "Close form",
  saveCatalog: "Save to catalog",
  displayName: "Display name (e.g. Snapp)",
  packageId: "packageId (e.g. cab.snapp.passenger)",
  localApkOptional: "Local APK path (optional)",
  githubOptional: "GitHub owner/repo (optional)",
  apkUrlOptional: "Direct APK URL (optional)",
  playAsk: "Is the Play account ready on the phone?",
  yes: "Yes",
  no: "No",
  whereInstall: "Install from where?",
  withoutPlay: "(without Google Play)",
  startInstall: "Start install",
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
  welcome: "Hi. Ask for shop Wi‑Fi, app install, or a phone backup.",
  sourceAuto: "Auto (recommended)",
  sourcePlay: "Google Play",
  sourceModelSearch: "Model search",
  sourceLocalApk: "Local APK on laptop",
  sourceGithub: "GitHub",
  sourceUrl: "Direct link",
  saved: "Saved.",
  installCancelled: "Install cancelled.",
  needLabelPackage: "Label and packageId are required",
  searchOpened: "Search opened — download the APK",
  backupStarted: "Backup started",
  devicesError: "Could not read devices",
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
    case "auto":
      return t(locale, "sourceAuto");
    case "play":
      return t(locale, "sourcePlay");
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

export const SOURCE_IDS = [
  "auto",
  "play",
  "model_search",
  "local_apk",
  "github",
  "url",
] as const;
