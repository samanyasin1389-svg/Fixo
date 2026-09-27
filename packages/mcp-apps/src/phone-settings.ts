import type { AdbRunner } from "@fixo/mcp-network";
import {
  getNetworkStatus,
  listDevices,
  setAirplaneMode,
  setMobileData,
  setWifi,
  shell,
} from "@fixo/mcp-network";

export type SettingKind = "detect" | "fix" | "guide";

export type SettingIssue = {
  id: string;
  categoryId: string;
  titleFa: string;
  titleEn: string;
  kind: SettingKind;
  /** Guide steps in Persian */
  stepsFa: string[];
  /** Optional ADB detect action key */
  detectKey?: string;
  /** Optional ADB fix action key */
  fixKey?: string;
};

export type SettingCategory = {
  id: string;
  titleFa: string;
  titleEn: string;
  icon: string;
};

export const PHONE_SETTING_CATEGORIES: SettingCategory[] = [
  { id: "dashboard", titleFa: "داشبورد", titleEn: "Dashboard", icon: "" },
  { id: "battery", titleFa: "باتری", titleEn: "Battery", icon: "" },
  { id: "display", titleFa: "صفحه", titleEn: "Display", icon: "" },
  { id: "network", titleFa: "اینترنت و شبکه", titleEn: "Network", icon: "" },
  { id: "audio", titleFa: "صدا", titleEn: "Audio", icon: "" },
  { id: "apps", titleFa: "برنامه‌ها", titleEn: "Apps", icon: "" },
  { id: "storage", titleFa: "حافظه", titleEn: "Storage", icon: "" },
  { id: "performance", titleFa: "کارایی", titleEn: "Performance", icon: "" },
  { id: "security", titleFa: "امنیت و دسترسی", titleEn: "Security", icon: "" },
  { id: "usb", titleFa: "USB و ADB", titleEn: "USB & ADB", icon: "" },
  { id: "sim", titleFa: "تماس و سیم‌کارت", titleEn: "SIM & Calls", icon: "" },
  { id: "notifications", titleFa: "اعلان‌ها", titleEn: "Notifications", icon: "" },
  { id: "camera", titleFa: "دوربین", titleEn: "Camera", icon: "" },
  { id: "location", titleFa: "موقعیت", titleEn: "Location", icon: "" },
  { id: "system", titleFa: "سیستم", titleEn: "System", icon: "" },
  { id: "diagnostics", titleFa: "عیب‌یابی", titleEn: "Diagnostics", icon: "" },
  { id: "datetime", titleFa: "تاریخ و ساعت", titleEn: "Date & Time", icon: "" },
];

function guide(id: string, categoryId: string, titleFa: string, titleEn: string, stepsFa: string[]): SettingIssue {
  return { id, categoryId, titleFa, titleEn, kind: "guide", stepsFa };
}

function detectFix(
  id: string,
  categoryId: string,
  titleFa: string,
  titleEn: string,
  stepsFa: string[],
  detectKey: string,
  fixKey?: string,
): SettingIssue {
  return {
    id,
    categoryId,
    titleFa,
    titleEn,
    kind: fixKey ? "fix" : "detect",
    stepsFa,
    detectKey,
    fixKey,
  };
}

export const PHONE_SETTING_ISSUES: SettingIssue[] = [
  // Date & time
  detectFix(
    "dt-wrong-date",
    "datetime",
    "تاریخ اشتباه",
    "Wrong date",
    ["خودکار تاریخ و ساعت را روشن کن", "منطقه زمانی تهران را انتخاب کن", "در صورت نیاز دستی تاریخ را درست کن"],
    "datetime_skew",
    "open_date_settings",
  ),
  detectFix(
    "dt-wrong-time",
    "datetime",
    "ساعت اشتباه",
    "Wrong time",
    ["Automatic date & time را روشن کن", "ساعت را با شبکه همگام کن"],
    "datetime_skew",
    "open_date_settings",
  ),
  detectFix(
    "dt-wrong-tz",
    "datetime",
    "Time Zone اشتباه",
    "Wrong time zone",
    ["Automatic time zone را روشن کن", "Asia/Tehran را انتخاب کن"],
    "datetime_skew",
    "open_date_settings",
  ),
  detectFix(
    "dt-auto-off",
    "datetime",
    "Automatic Date & Time خاموش",
    "Auto date/time off",
    ["Settings → System → Date & time → Automatic را روشن کن"],
    "auto_time",
    "open_date_settings",
  ),
  detectFix(
    "dt-auto-tz-off",
    "datetime",
    "Automatic Time Zone خاموش",
    "Auto time zone off",
    ["Automatic time zone را روشن کن"],
    "auto_timezone",
    "open_date_settings",
  ),

  // Network
  detectFix(
    "net-wifi-fail",
    "network",
    "Wi-Fi وصل نمی‌شود",
    "Wi-Fi won't connect",
    ["وای‌فای را خاموش/روشن کن", "شبکه مغازه را فراموش و دوباره وصل کن", "Reset network settings"],
    "wifi_status",
    "wifi_on",
  ),
  detectFix(
    "net-wifi-no-internet",
    "network",
    "Wi-Fi وصل است ولی اینترنت ندارد",
    "Wi-Fi connected, no internet",
    ["DNS خصوصی را خاموش کن", "پروکسی/وی‌پی‌ان باقی‌مانده را پاک کن", "APN را چک کن"],
    "wifi_status",
  ),
  detectFix(
    "net-mobile-data",
    "network",
    "Mobile Data کار نمی‌کند",
    "Mobile data not working",
    ["دیتا را روشن کن", "سیم‌کارت دیتا را درست انتخاب کن", "APN اپراتور را درست کن"],
    "mobile_data_status",
    "mobile_data_on",
  ),
  guide("net-apn", "network", "APN اشتباه", "Wrong APN", [
    "Settings → Mobile network → Access Point Names",
    "APN اپراتور را انتخاب یا Reset to default",
  ]),
  guide("net-hotspot", "network", "Hotspot کار نمی‌کند", "Hotspot broken", [
    "Hotspot را خاموش/روشن کن",
    "باند ۲٫۴GHz را امتحان کن",
    "محدودیت داده هات‌اسپات را چک کن",
  ]),
  guide("net-private-dns", "network", "Private DNS اشتباه", "Wrong Private DNS", [
    "Settings → Network → Private DNS → Off یا Automatic",
  ]),
  guide("net-vpn-left", "network", "VPN/Proxy باقی‌مانده", "Leftover VPN/Proxy", [
    "همه پروفایل وی‌پی‌ان را Disconnect/Delete کن",
    "Proxy Wi‑Fi را None بگذار",
  ]),
  detectFix(
    "net-reset",
    "network",
    "Reset Network Settings",
    "Reset network settings",
    ["Settings → System → Reset → Reset Wi‑Fi, mobile & Bluetooth"],
    "wifi_status",
    "open_wifi_settings",
  ),
  detectFix(
    "net-airplane",
    "network",
    "حالت هواپیما روشن مانده",
    "Airplane mode stuck on",
    ["حالت هواپیما را خاموش کن"],
    "airplane_status",
    "airplane_off",
  ),

  // Audio
  guide("aud-muted", "audio", "صدای گوشی قطع شده", "Phone muted", [
    "Volume Up را چند بار بزن",
    "Silent / Vibrate را خاموش کن",
    "Do Not Disturb را خاموش کن",
  ]),
  guide("aud-ringtone", "audio", "صدای زنگ نمی‌آید", "No ringtone", [
    "Settings → Sound → Ringtone را چک کن",
    "حجم Ring را بالا ببر",
  ]),
  guide("aud-notif", "audio", "Notification صدا ندارد", "No notification sound", [
    "حجم Notification را بالا ببر",
    "صدا را برای همان اپ فعال کن",
  ]),
  guide("aud-silent", "audio", "گوشی روی Silent است", "Silent mode", [
    "کلید صدا یا Control center → Silent را خاموش کن",
  ]),
  guide("aud-dnd", "audio", "Do Not Disturb روشن مانده", "DND on", [
    "Settings → Notifications → Do Not Disturb → Off",
  ]),
  guide("aud-media-low", "audio", "Media Volume پایین است", "Media volume low", [
    "با پخش موزیک، Volume Up بزن",
  ]),
  guide("aud-vibrate", "audio", "ویبره کار نمی‌کند", "Vibrate broken", [
    "Settings → Sound → Vibration را روشن کن",
    "اگر سخت‌افزاری است به تعمیرکار سخت‌افزار بسپار",
  ]),

  // Display
  guide("disp-bright", "display", "صفحه خیلی تاریک/روشن است", "Brightness wrong", [
    "Brightness را دستی تنظیم کن",
    "Adaptive brightness را خاموش/روشن کن",
  ]),
  guide("disp-auto-bright", "display", "Auto Brightness مشکل دارد", "Auto brightness issue", [
    "Adaptive/Auto brightness را خاموش کن و دستی تنظیم کن",
  ]),
  guide("disp-timeout", "display", "صفحه خاموش نمی‌شود یا سریع خاموش می‌شود", "Screen timeout", [
    "Settings → Display → Screen timeout را تنظیم کن",
  ]),
  guide("disp-rotate", "display", "Auto Rotate کار نمی‌کند", "Auto rotate broken", [
    "Quick settings → Auto-rotate را روشن کن",
  ]),
  guide("disp-font", "display", "اندازه فونت به‌هم ریخته", "Font size wrong", [
    "Settings → Display → Font size را Default کن",
  ]),
  guide("disp-size", "display", "Display Size اشتباه است", "Display size wrong", [
    "Settings → Display → Display size را Default کن",
  ]),
  guide("disp-dark", "display", "Dark Mode اشتباهی فعال شده", "Dark mode on by mistake", [
    "Settings → Display → Dark theme را Off کن",
  ]),

  // Notifications
  guide("ntf-app", "notifications", "اعلان یک برنامه نمی‌آید", "App notifications missing", [
    "App info → Notifications → Allow",
    "Battery optimization را Unrestricted کن",
  ]),
  guide("ntf-lock", "notifications", "اعلان روی Lock Screen نیست", "No lock-screen notifications", [
    "Notifications → Lock screen → Show conversations/notifications",
  ]),
  guide("ntf-sound", "notifications", "صدای اعلان نمی‌آید", "No notification sound", [
    "حجم Notification را بالا ببر",
    "صدا را برای کانال همان اپ فعال کن",
  ]),
  guide("ntf-perm", "notifications", "Notification Permission خاموش است", "Notification permission off", [
    "Settings → Apps → App → Notifications → Allow",
  ]),
  guide("ntf-battery", "notifications", "Battery Optimization جلوی اعلان را گرفته", "Battery kills notifications", [
    "App battery → Unrestricted",
  ]),

  // Battery
  guide("bat-high", "battery", "مصرف باتری زیاد شده", "High battery drain", [
    "Battery usage را ببین؛ اپ پرمصرف را محدود کن",
    "Adaptive battery را چک کن",
  ]),
  guide("bat-saver", "battery", "Battery Saver اشتباهی فعال است", "Battery saver on", [
    "Battery saver را خاموش کن",
  ]),
  guide("bat-bg", "battery", "برنامه در Background باتری می‌خورد", "Background drain", [
    "App battery → Restricted یا Unrestricted را درست انتخاب کن",
  ]),
  guide("bat-limited", "battery", "Background Activity محدود شده", "Background limited", [
    "App → Battery → Allow background activity",
  ]),
  guide("bat-charge", "battery", "شارژ کند به‌خاطر تنظیمات", "Slow charge settings", [
    "حالت‌های محافظ شارژ / Battery protection را چک کن",
  ]),

  // Apps
  guide("app-open", "apps", "برنامه باز نمی‌شود", "App won't open", [
    "Force stop → Clear cache",
    "در صورت نیاز Clear data یا نصب مجدد",
  ]),
  guide("app-crash", "apps", "برنامه Crash می‌کند", "App crashes", [
    "Clear cache/data",
    "آپدیت از Play یا نصب مجدد",
  ]),
  guide("app-perm", "apps", "Permission برنامه قطع شده", "App permission denied", [
    "App info → Permissions را یکی‌یکی Allow کن",
  ]),
  guide("app-links", "apps", "لینک‌ها با برنامه اشتباه باز می‌شوند", "Wrong app opens links", [
    "App → Open by default → Clear defaults",
    "Default apps را درست کن",
  ]),
  guide("app-default", "apps", "Default App اشتباه است", "Wrong default app", [
    "Settings → Apps → Default apps",
  ]),
  guide("app-cache", "apps", "Cache برنامه مشکل‌دار است", "Bad app cache", [
    "App info → Storage → Clear cache",
  ]),
  guide("app-bg", "apps", "اجازه Background ندارد", "No background run", [
    "App battery → Unrestricted",
  ]),

  // SIM
  guide("sim-mobile-off", "sim", "Mobile Network خاموش است", "Mobile network off", [
    "Quick settings → Mobile data / Airplane را چک کن",
  ]),
  guide("sim-call", "sim", "SIM تماس اشتباه است", "Wrong SIM for calls", [
    "Settings → SIM → Calls → سیم درست را انتخاب کن",
  ]),
  guide("sim-data", "sim", "SIM اینترنت اشتباه است", "Wrong SIM for data", [
    "Settings → SIM → Mobile data → سیم درست",
  ]),
  guide("sim-volte", "sim", "VoLTE خاموش/روشن است", "VoLTE toggle", [
    "Settings → Mobile network → VoLTE را طبق نیاز تنظیم کن",
  ]),
  guide("sim-mode", "sim", "Network Mode اشتباه است", "Wrong network mode", [
    "Preferred network type: 4G/5G/LTE را درست کن",
  ]),
  guide("sim-operator", "sim", "مشکل انتخاب اپراتور", "Operator selection", [
    "Network operators → Select automatically",
  ]),

  // Security / permissions
  guide("sec-loc", "security", "Location خاموش است", "Location off", [
    "Settings → Location → On",
  ]),
  guide("sec-cam", "security", "Camera Permission خاموش است", "Camera permission off", [
    "App → Permissions → Camera → Allow",
  ]),
  guide("sec-mic", "security", "Microphone Permission خاموش است", "Mic permission off", [
    "App → Permissions → Microphone → Allow",
  ]),
  guide("sec-ntf", "security", "Notification Permission خاموش است", "Notification permission off", [
    "App → Notifications → Allow",
  ]),
  guide("sec-files", "security", "Photos/Files Permission خاموش است", "Files permission off", [
    "App → Permissions → Photos and videos / Files → Allow",
  ]),

  // USB
  detectFix(
    "usb-charging",
    "usb",
    "USB روی Charging Only است",
    "USB charging only",
    ["نوتیفیکیشن USB → File transfer / MTP را بزن"],
    "adb_connected",
    "open_developer_settings",
  ),
  detectFix(
    "usb-mtp",
    "usb",
    "File Transfer فعال نیست",
    "File transfer off",
    ["USB notification → File transfer"],
    "adb_connected",
  ),
  detectFix(
    "usb-debug",
    "usb",
    "USB Debugging خاموش است",
    "USB debugging off",
    ["Developer options → USB debugging را روشن کن"],
    "adb_connected",
    "open_developer_settings",
  ),
  detectFix(
    "usb-adb",
    "usb",
    "ADB دستگاه را نمی‌شناسد",
    "ADB doesn't see device",
    ["کابل/پورت را عوض کن", "Authorize این کامپیوتر را تأیید کن", "adb kill-server && adb devices"],
    "adb_connected",
  ),
  guide("usb-tether", "usb", "USB Tethering فعال نیست", "USB tethering off", [
    "Settings → Hotspot & tethering → USB tethering",
  ]),

  // Camera / Location / Storage / Performance / System / Diagnostics / Dashboard
  guide("cam-app", "camera", "دوربین باز نمی‌شود", "Camera won't open", [
    "Permission دوربین را Allow کن",
    "اپ دوربین پیش‌فرض را Force stop کن",
  ]),
  guide("loc-off", "location", "Location برای اپ‌ها کار نمی‌کند", "Location broken for apps", [
    "Location را On کن",
    "App permission → Location → Allow all the time / while using",
  ]),
  guide("sto-full", "storage", "حافظه پر است", "Storage full", [
    "Files → حذف کش و دانلودهای اضافی",
    "اپ‌های بلااستفاده را Uninstall کن",
  ]),
  guide("perf-lag", "performance", "گوشی کند شده", "Phone lagging", [
    "کش سنگین را پاک کن",
    "اپ‌های پشت‌زمینه را محدود کن",
    "Restart",
  ]),
  guide("sys-update", "system", "آپدیت سیستم گیر کرده", "System update stuck", [
    "Settings → System update را چک کن",
    "فضای کافی و شارژ/وای‌فای پایدار لازم است",
  ]),
  guide("diag-safe", "diagnostics", "تست Safe Mode", "Safe mode test", [
    "با Power menu به Safe mode برو",
    "اگر مشکل رفت، اپ شخص ثالث را پاک کن",
  ]),
  guide("dash-overview", "dashboard", "مرور وضعیت کلی", "Status overview", [
    "از دسته‌های شبکه، باتری، USB شروع کن",
    "ابتدا Detectهای خودکار را بزن",
  ]),
];

export type DetectResult = {
  ok: boolean;
  issueId?: string;
  key: string;
  status: "ok" | "problem" | "unknown";
  message: string;
  details?: Record<string, unknown>;
  evidence: string[];
};

export type FixResult = {
  ok: boolean;
  key: string;
  message: string;
  evidence: string[];
};

async function readSetting(adb: AdbRunner, serial: string, namespace: string, key: string) {
  const r = await shell(adb, serial, `settings get ${namespace} ${key}`);
  return { value: r.stdout.trim(), evidence: r.evidence };
}

export async function detectPhoneSetting(
  adb: AdbRunner,
  serial: string | undefined,
  detectKey: string,
): Promise<DetectResult> {
  const evidence: string[] = [];

  if (detectKey === "adb_connected") {
    const devices = await listDevices(adb);
    evidence.push(`devices=${JSON.stringify(devices)}`);
    const ready = devices.filter((d) => d.status === "device");
    if (ready.length === 0) {
      return {
        ok: false,
        key: detectKey,
        status: "problem",
        message: "هیچ گوشی ADB آماده‌ای نیست",
        details: { devices },
        evidence,
      };
    }
    return {
      ok: true,
      key: detectKey,
      status: "ok",
      message: `${ready.length} دستگاه آماده: ${ready.map((d) => d.serial).join(", ")}`,
      details: { devices: ready },
      evidence,
    };
  }

  if (!serial) {
    return {
      ok: false,
      key: detectKey,
      status: "unknown",
      message: "سریال دستگاه لازم است",
      evidence,
    };
  }

  if (
    detectKey === "wifi_status" ||
    detectKey === "mobile_data_status" ||
    detectKey === "airplane_status"
  ) {
    const { status, evidence: ev } = await getNetworkStatus(adb, serial);
    evidence.push(...ev);
    if (detectKey === "wifi_status") {
      const problem = status.wifiEnabled === false;
      return {
        ok: !problem,
        key: detectKey,
        status: problem ? "problem" : status.wifiEnabled == null ? "unknown" : "ok",
        message: problem
          ? "وای‌فای خاموش است"
          : status.wifiConnected
            ? `وای‌فای روشن و وصل به ${status.wifiSsid || "شبکه"}`
            : "وای‌فای روشن است (ممکن است به شبکه وصل نباشد)",
        details: { ...status },
        evidence,
      };
    }
    if (detectKey === "mobile_data_status") {
      const problem = status.mobileDataEnabled === false;
      return {
        ok: !problem,
        key: detectKey,
        status: problem ? "problem" : status.mobileDataEnabled == null ? "unknown" : "ok",
        message: problem ? "دیتای موبایل خاموش است" : "دیتای موبایل روشن است",
        details: { ...status },
        evidence,
      };
    }
    const airplaneOn = status.airplaneMode === true;
    return {
      ok: !airplaneOn,
      key: detectKey,
      status: airplaneOn ? "problem" : status.airplaneMode == null ? "unknown" : "ok",
      message: airplaneOn ? "حالت هواپیما روشن است" : "حالت هواپیما خاموش است",
      details: { ...status },
      evidence,
    };
  }

  if (detectKey === "auto_time" || detectKey === "auto_timezone" || detectKey === "datetime_skew") {
    const autoTime = await readSetting(adb, serial, "global", "auto_time");
    const autoTz = await readSetting(adb, serial, "global", "auto_time_zone");
    evidence.push(autoTime.evidence, autoTz.evidence);
    const dateCmd = await shell(adb, serial, "date +%s");
    evidence.push(dateCmd.evidence);
    const phoneEpoch = Number(dateCmd.stdout.trim());
    const pcEpoch = Math.floor(Date.now() / 1000);
    const skewSec = Number.isFinite(phoneEpoch) ? Math.abs(phoneEpoch - pcEpoch) : null;

    if (detectKey === "auto_time") {
      const on = autoTime.value === "1";
      return {
        ok: on,
        key: detectKey,
        status: on ? "ok" : "problem",
        message: on ? "Automatic date & time روشن است" : "Automatic date & time خاموش است",
        details: { autoTime: autoTime.value },
        evidence,
      };
    }
    if (detectKey === "auto_timezone") {
      const on = autoTz.value === "1";
      return {
        ok: on,
        key: detectKey,
        status: on ? "ok" : "problem",
        message: on ? "Automatic time zone روشن است" : "Automatic time zone خاموش است",
        details: { autoTimezone: autoTz.value },
        evidence,
      };
    }

    const skewProblem = skewSec != null && skewSec > 120;
    return {
      ok: !skewProblem,
      key: detectKey,
      status: skewProblem ? "problem" : skewSec == null ? "unknown" : "ok",
      message: skewProblem
        ? `ساعت گوشی حدود ${Math.round((skewSec ?? 0) / 60)} دقیقه با سیستم مغازه اختلاف دارد`
        : "ساعت گوشی با سیستم هم‌خوان است",
      details: {
        phoneEpoch,
        pcEpoch,
        skewSec,
        autoTime: autoTime.value,
        autoTimezone: autoTz.value,
      },
      evidence,
    };
  }

  return {
    ok: false,
    key: detectKey,
    status: "unknown",
    message: `تشخیص برای «${detectKey}» هنوز پیاده نشده`,
    evidence,
  };
}

export async function fixPhoneSetting(
  adb: AdbRunner,
  serial: string,
  fixKey: string,
): Promise<FixResult> {
  const evidence: string[] = [];

  if (fixKey === "wifi_on") {
    const r = await setWifi(adb, serial, true);
    evidence.push(...r.evidence);
    return { ok: true, key: fixKey, message: "وای‌فای روشن شد", evidence };
  }
  if (fixKey === "mobile_data_on") {
    const r = await setMobileData(adb, serial, true);
    evidence.push(...r.evidence);
    return { ok: true, key: fixKey, message: "دیتای موبایل روشن شد", evidence };
  }
  if (fixKey === "airplane_off") {
    const r = await setAirplaneMode(adb, serial, false);
    evidence.push(...r.evidence);
    return { ok: true, key: fixKey, message: "حالت هواپیما خاموش شد", evidence };
  }
  if (fixKey === "open_date_settings") {
    const r = await shell(adb, serial, "am start -a android.settings.DATE_SETTINGS");
    evidence.push(r.evidence);
    return {
      ok: r.code === 0,
      key: fixKey,
      message: "صفحه تاریخ و ساعت باز شد",
      evidence,
    };
  }
  if (fixKey === "open_wifi_settings") {
    const r = await shell(adb, serial, "am start -a android.settings.WIFI_SETTINGS");
    evidence.push(r.evidence);
    return {
      ok: r.code === 0,
      key: fixKey,
      message: "صفحه وای‌فای باز شد",
      evidence,
    };
  }
  if (fixKey === "open_developer_settings") {
    const r = await shell(
      adb,
      serial,
      "am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS",
    );
    evidence.push(r.evidence);
    return {
      ok: r.code === 0,
      key: fixKey,
      message: "Developer options باز شد",
      evidence,
    };
  }

  return {
    ok: false,
    key: fixKey,
    message: `اکشن «${fixKey}» پشتیبانی نمی‌شود`,
    evidence,
  };
}

export function listPhoneSettingsCatalog() {
  return {
    categories: PHONE_SETTING_CATEGORIES,
    issues: PHONE_SETTING_ISSUES,
  };
}

export function getIssueById(id: string): SettingIssue | undefined {
  return PHONE_SETTING_ISSUES.find((i) => i.id === id);
}
