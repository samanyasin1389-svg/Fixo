/** Common repair-shop app aliases → Play package IDs */
export const APP_ALIASES: Record<string, string> = {
  whatsapp: "com.whatsapp",
  واتساپ: "com.whatsapp",
  "واتس اپ": "com.whatsapp",
  instagram: "com.instagram.android",
  اینستاگرام: "com.instagram.android",
  اینستا: "com.instagram.android",
  telegram: "org.telegram.messenger",
  تلگرام: "org.telegram.messenger",
  chrome: "com.android.chrome",
  کروم: "com.android.chrome",
  youtube: "com.google.android.youtube",
  یوتیوب: "com.google.android.youtube",
  maps: "com.google.android.apps.maps",
  نقشه: "com.google.android.apps.maps",
  gmail: "com.google.android.gm",
  جیمیل: "com.google.android.gm",
  facebook: "com.facebook.katana",
  فیسبوک: "com.facebook.katana",
  tiktok: "com.zhiliaoapp.musically",
  تیکتاک: "com.zhiliaoapp.musically",
  snapp: "cab.snapp.passenger",
  اسنپ: "cab.snapp.passenger",
  rubika: "ir.mservices.market",
};

export function resolvePackageId(input: string): {
  packageId: string;
  alias?: string;
} {
  const raw = input.trim();
  if (!raw) {
    throw new Error("packageId or app name is required");
  }
  if (/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(raw)) {
    return { packageId: raw };
  }
  const key = raw.toLowerCase();
  const fromAlias = APP_ALIASES[key] || APP_ALIASES[raw];
  if (fromAlias) return { packageId: fromAlias, alias: raw };
  throw new Error(
    `Unknown app name "${raw}". Pass a Play packageId like com.whatsapp or a known alias (whatsapp, telegram, instagram, ...).`,
  );
}
