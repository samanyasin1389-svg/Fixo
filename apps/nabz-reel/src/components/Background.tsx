import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { colors } from "../lib/theme";
import { ease } from "../lib/timing";

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 30;

  const orb1x = 20 + Math.sin(t * 0.55) * 8;
  const orb1y = 18 + Math.cos(t * 0.42) * 6;
  const orb2x = 68 + Math.cos(t * 0.38) * 10;
  const orb2y = 62 + Math.sin(t * 0.5) * 8;
  const orb3x = 42 + Math.sin(t * 0.28 + 1) * 12;
  const orb3y = 78 + Math.cos(t * 0.33) * 7;

  const grain = interpolate(Math.sin(frame * 1.7), [-1, 1], [0.035, 0.055], {
    easing: ease.inOutQuint,
  });

  return (
    <AbsoluteFill
      style={{
        background: colors.navy,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 720,
          height: 720,
          borderRadius: "50%",
          left: `${orb1x}%`,
          top: `${orb1y}%`,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${colors.purple}55 0%, transparent 70%)`,
          filter: "blur(8px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 640,
          height: 640,
          borderRadius: "50%",
          left: `${orb2x}%`,
          top: `${orb2y}%`,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${colors.cyan}40 0%, transparent 70%)`,
          filter: "blur(10px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          left: `${orb3x}%`,
          top: `${orb3y}%`,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${colors.purple}33 0%, ${colors.cyan}22 40%, transparent 70%)`,
          filter: "blur(12px)",
        }}
      />

      {/* soft grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(244,242,251,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(244,242,251,0.035) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
          opacity: 0.55,
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 78%)",
        }}
      />

      {/* vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(8,6,18,0.78) 100%)",
        }}
      />

      {/* film grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: grain,
          mixBlendMode: "overlay",
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </AbsoluteFill>
  );
};
