import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { colors, fonts } from "../lib/theme";
import { WORD_STAGGER, ease, FPS } from "../lib/timing";

type Props = {
  text: string;
  startSec: number;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: "right" | "center" | "left";
  maxWidth?: number;
  lineHeight?: number;
  dir?: "rtl" | "ltr";
  latin?: boolean;
};

export const MaskedWords: React.FC<Props> = ({
  text,
  startSec,
  fontSize = 52,
  fontWeight = 800,
  color = colors.white,
  align = "right",
  maxWidth = 880,
  lineHeight = 1.35,
  dir = "rtl",
  latin = false,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ").filter(Boolean);

  return (
    <div
      dir={dir}
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent:
          align === "center"
            ? "center"
            : align === "left"
              ? "flex-start"
              : "flex-end",
        gap: "0.28em 0.32em",
        maxWidth,
        fontFamily: latin ? fonts.en : fonts.fa,
        fontSize,
        fontWeight,
        color,
        lineHeight,
        textAlign: align,
      }}
    >
      {words.map((word, i) => {
        const wordStart = startSec + i * WORD_STAGGER;
        const local = frame / FPS - wordStart;
        const progress = interpolate(local, [0, 0.38], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease.outQuint,
        });
        const y = interpolate(progress, [0, 1], [28, 0]);
        const blur = interpolate(progress, [0, 1], [8, 0]);
        const opacity = progress;

        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: "inline-block",
              overflow: "hidden",
              verticalAlign: "bottom",
              paddingBottom: 4,
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${y}px)`,
                filter: `blur(${blur}px)`,
                opacity,
              }}
            >
              {word}
            </span>
          </span>
        );
      })}
    </div>
  );
};

export const Kicker: React.FC<{
  text: string;
  startSec: number;
  align?: "right" | "center" | "left";
}> = ({ text, startSec, align = "right" }) => {
  const frame = useCurrentFrame();
  const local = frame / FPS - startSec;
  const progress = interpolate(local, [0, 0.32], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease.outQuint,
  });

  return (
    <div
      style={{
        fontFamily: fonts.en,
        fontSize: 18,
        fontWeight: 600,
        letterSpacing: "0.28em",
        color: colors.cyan,
        textTransform: "uppercase",
        opacity: progress,
        transform: `translateY(${interpolate(progress, [0, 1], [10, 0])}px)`,
        textAlign: align,
        width: "100%",
        marginBottom: 14,
      }}
    >
      {text}
    </div>
  );
};
