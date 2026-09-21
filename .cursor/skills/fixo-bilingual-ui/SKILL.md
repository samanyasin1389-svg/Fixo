---
name: fixo-bilingual-ui
description: Keep Fixo desktop UI strings synced in Persian and English with correct RTL/LTR. Use when editing App.tsx, i18n.ts, labels, toggles, or connection badges.
---

# Fixo bilingual UI

## Rules

- Every user-visible string lives in `apps/desktop/src/ui/i18n.ts` under both `fa` and `en`.
- Never hardcode Persian or English in JSX except brand name `Fixo` and technical tokens.
- Allowed untranslated tokens: Wi‑Fi, ADB, APK, Play, GitHub, USB, SSID.
- When `locale === "fa"`: `dir=rtl`, `lang=fa`. When `en`: `dir=ltr`, `lang=en`.
- Apply `dir` / `lang` / `data-theme` on `document.documentElement`, not only on a wrapper.
- Keep FA and EN keys identical; if you add a key, add both locales in the same commit.
- Tone: short repair-shop speech (see `persian-repair-shop-copy` and `human-natural-writing`).

## Checklist

- New button or label → both locales
- Theme toggle labels localized
- Connection badge: وصل / Connected, قطع / Disconnected
- Layout still readable in LTR (source list alignment, actions gap)
