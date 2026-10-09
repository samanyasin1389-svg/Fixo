import { Easing } from "remotion";

/** 124 BPM → seconds per beat */
export const BPM = 124;
export const BEAT = 60 / BPM; // ≈ 0.4839s
export const FPS = 30;
export const DURATION_SEC = 22;
export const TOTAL_FRAMES = DURATION_SEC * FPS; // 660

export const beatFrame = (beat: number) => Math.round(beat * BEAT * FPS);

export const WORD_STAGGER = 0.045; // seconds between masked words

export const Acts = {
  hook: { start: 0, end: 3 },
  demo: { start: 3, end: 10 },
  numbers: { start: 10, end: 14 },
  card: { start: 14, end: 18 },
  outro: { start: 18, end: 22 },
} as const;

export const ease = {
  outQuint: Easing.out(Easing.poly(5)),
  inOutQuint: Easing.inOut(Easing.poly(5)),
  inCubic: Easing.in(Easing.cubic),
  overshoot: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

export const secToFrame = (s: number) => Math.round(s * FPS);
