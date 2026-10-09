export const colors = {
  purple: "#6C47FF",
  cyan: "#22D3EE",
  navy: "#0E0B1F",
  white: "#F4F2FB",
  whiteMuted: "rgba(244, 242, 251, 0.72)",
  card: "rgba(24, 18, 48, 0.88)",
  cardBorder: "rgba(244, 242, 251, 0.14)",
  danger: "#FF5A7A",
  success: "#34D399",
} as const;

export const fonts = {
  fa: "Mikhak, sans-serif",
  en: "Inter, sans-serif",
} as const;

/** Instagram safe text zone for 1080×1920 */
export const safe = {
  xMin: 60,
  xMax: 1020,
  yMin: 220,
  yMax: 1540,
  width: 960,
  centerX: 540,
} as const;
