---
name: ui-ux-spacing
description: Spacing, hierarchy, and density rules for Fixo desktop UI. Use when editing App.tsx, styles.css, panels, menus, and dialogs.
---

# UI / UX spacing

## Goal

Keep Fixo readable on a laptop at the repair counter — one task per block, comfortable gaps, no dashboard clutter.

## Hierarchy

1. Brand (Fixo) stays the strongest text in the header.
2. Each panel section: one title, one short helper line, then controls.
3. Collapse secondary lists (apps catalog) behind a disclosure; do not dump every app in the first viewport.

## Spacing scale

Use consistent gaps from styles:

- Section stack: 14–20px
- Control group: 8–10px
- Inline chips / source options: 6–8px
- Panel padding: ~16px

Avoid stacking more than three primary buttons without wrapping.

## Interaction containers

- Cards only when they wrap a real choice (install source picker, confirm strip).
- Prefer open rows + borders over nested cards.
- Collapsible "برنامه‌ها" menu: chevron + count; expanded body shows multi-select + add form.

## Density

- Status pills stay compact; do not enlarge them into badges.
- Backup progress: one progress line + pause/resume/cancel — no extra stats strip.
- Mobile: single column; keep tap targets ≥ 40px height.

## Motion (light)

- Soft expand/collapse for apps menu (~150–200ms).
- Progress bar width transition only — no bouncing or glow spam.

## Checklist

- First glance: brand, network status, one primary network action.
- Apps and backup do not compete with network controls.
- Empty states use one muted sentence, not illustrations.
