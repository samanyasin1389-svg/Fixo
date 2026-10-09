import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Background } from "./components/Background";
import { FontFaces } from "./components/Fonts";
import { HeroPhone, HeroMode } from "./components/HeroPhone";
import { Kicker, MaskedWords } from "./components/MaskedWords";
import { colors, fonts, safe } from "./lib/theme";
import { Acts, FPS, ease, secToFrame } from "./lib/timing";

const Flash: React.FC<{ at: number; duration?: number }> = ({
  at,
  duration = 0.12,
}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const opacity = interpolate(
    t,
    [at, at + duration * 0.35, at + duration],
    [0, 0.85, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        background: colors.white,
        opacity,
        mixBlendMode: "screen",
        pointerEvents: "none",
        zIndex: 40,
      }}
    />
  );
};

const SafeOverlay: React.FC<{ children: React.ReactNode; top?: number }> = ({
  children,
  top = 240,
}) => (
  <div
    style={{
      position: "absolute",
      left: safe.xMin,
      width: safe.width,
      top,
      zIndex: 20,
      pointerEvents: "none",
    }}
  >
    {children}
  </div>
);

const HookCopy: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const exit = interpolate(t, [2.55, 2.95], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease.inCubic,
  });

  return (
    <SafeOverlay top={260}>
      <div style={{ opacity: exit, transform: `translateY(${(1 - exit) * -20}px)` }}>
        <Kicker text="DAILY FRICTION" startSec={0.15} />
        <MaskedWords
          text="هر روز همین درده؟"
          startSec={0.35}
          fontSize={56}
          fontWeight={900}
        />
        <div style={{ height: 16 }} />
        <MaskedWords
          text="چت نمی‌کنه، کار می‌کنه"
          startSec={1.1}
          fontSize={28}
          fontWeight={600}
          color={colors.whiteMuted}
        />
      </div>
    </SafeOverlay>
  );
};

const DemoCopy: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS - Acts.demo.start;
  const opacity = interpolate(t, [0, 0.35, 6.2, 6.7], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SafeOverlay top={250}>
      <div style={{ opacity }}>
        <Kicker text="LIVE BENCH DEMO" startSec={Acts.demo.start + 0.1} />
        <MaskedWords
          text="هوش مصنوعی روی میز تعمیرات"
          startSec={Acts.demo.start + 0.25}
          fontSize={40}
          fontWeight={800}
        />
        <div style={{ height: 10 }} />
        <MaskedWords
          text="وصل، وای‌فای، نصب، بک‌آپ"
          startSec={Acts.demo.start + 0.85}
          fontSize={22}
          fontWeight={600}
          color={colors.whiteMuted}
        />
      </div>
    </SafeOverlay>
  );
};

const NumbersCopy: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS - Acts.numbers.start;
  const opacity = interpolate(t, [0.85, 1.15, 3.4, 3.85], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SafeOverlay top={260}>
      <div style={{ opacity, textAlign: "center" }}>
        <Kicker text="NOT A CHATBOT" startSec={Acts.numbers.start + 0.9} align="center" />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <MaskedWords
            text="۷ قابلیت واقعی، یک میزکار"
            startSec={Acts.numbers.start + 1.05}
            fontSize={32}
            fontWeight={800}
            align="center"
          />
        </div>
        <div
          style={{
            marginTop: 12,
            fontFamily: fonts.fa,
            fontSize: 14,
            fontWeight: 500,
            color: colors.whiteMuted,
            textAlign: "center",
            direction: "rtl",
          }}
        >
          منبع: README رسمی Fixo — بخش قابلیت‌ها
        </div>
      </div>
    </SafeOverlay>
  );
};

const CardCopy: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS - Acts.card.start;
  const opacity = interpolate(t, [0.2, 0.5, 3.3, 3.7], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SafeOverlay top={250}>
      <div style={{ opacity }}>
        <Kicker text="PRODUCT CARD" startSec={Acts.card.start + 0.15} />
        <MaskedWords
          text="هوش مصنوعی روزمره یعنی همین"
          startSec={Acts.card.start + 0.3}
          fontSize={36}
          fontWeight={800}
        />
      </div>
    </SafeOverlay>
  );
};

const OutroCopy: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS - Acts.outro.start;
  const opacity = interpolate(t, [0.1, 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SafeOverlay top={260}>
      <div style={{ opacity }}>
        <Kicker text="@NABZ_FARDA" startSec={Acts.outro.start + 0.1} />
        <MaskedWords
          text="نبض فردا رو دنبال کن"
          startSec={Acts.outro.start + 0.25}
          fontSize={40}
          fontWeight={900}
        />
      </div>
    </SafeOverlay>
  );
};

function resolveMode(t: number): {
  mode: HeroMode;
  glitch: number;
  dive: number;
  wipe: number;
} {
  const glitch = interpolate(t, [2.55, 2.7, 2.85, 3.05], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dive = interpolate(t, [10.0, 10.55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease.inCubic,
  });

  const wipe = interpolate(t, [14.0, 14.45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease.outQuint,
  });

  if (t < 3.0) return { mode: "chaos", glitch, dive: 0, wipe: 0 };
  if (t < 10.0) return { mode: "demo", glitch: 0, dive: 0, wipe: 0 };
  if (t < 14.0) return { mode: "stats", glitch: 0, dive, wipe: 0 };
  if (t < 18.0) return { mode: "card", glitch: 0, dive: 0, wipe };
  return { mode: "follow", glitch: 0, dive: 0, wipe: 0 };
}

export const NabzFardaReel: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { mode, glitch, dive, wipe } = resolveMode(t);

  // gentle handheld drift on whole scene
  const camX = Math.sin(t * 0.37) * 6;
  const camY = Math.cos(t * 0.29) * 4;
  const camZ = 1 + Math.sin(t * 0.21) * 0.008;

  return (
    <AbsoluteFill style={{ background: colors.navy }}>
      <FontFaces />
      <Audio src={staticFile("audio/reel-mix.wav")} />

      <AbsoluteFill
        style={{
          transform: `translate(${camX}px, ${camY}px) scale(${camZ})`,
        }}
      >
        <Background />
        <HeroPhone mode={mode} glitch={glitch} dive={dive} wipe={wipe} />

        <Sequence from={0} durationInFrames={secToFrame(3.1)} layout="none">
          <HookCopy />
        </Sequence>
        <Sequence
          from={secToFrame(Acts.demo.start)}
          durationInFrames={secToFrame(7)}
          layout="none"
        >
          <DemoCopy />
        </Sequence>
        <Sequence
          from={secToFrame(Acts.numbers.start)}
          durationInFrames={secToFrame(4)}
          layout="none"
        >
          <NumbersCopy />
        </Sequence>
        <Sequence
          from={secToFrame(Acts.card.start)}
          durationInFrames={secToFrame(4)}
          layout="none"
        >
          <CardCopy />
        </Sequence>
        <Sequence
          from={secToFrame(Acts.outro.start)}
          durationInFrames={secToFrame(4)}
          layout="none"
        >
          <OutroCopy />
        </Sequence>

        <Flash at={2.7} duration={0.14} />
        <Flash at={10.5} duration={0.1} />
        <Flash at={14.2} duration={0.1} />
        <Flash at={20.45} duration={0.08} />
      </AbsoluteFill>

      {/* brand watermark subtle */}
      <div
        style={{
          position: "absolute",
          bottom: 72,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: fonts.en,
          fontSize: 13,
          letterSpacing: "0.24em",
          color: "rgba(244,242,251,0.35)",
          zIndex: 30,
        }}
      >
        NABZ FARDA
      </div>
    </AbsoluteFill>
  );
};
