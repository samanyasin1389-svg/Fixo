import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { colors, fonts } from "../lib/theme";
import { Acts, ease, FPS } from "../lib/timing";

export type HeroMode = "chaos" | "demo" | "stats" | "card" | "follow";

type Props = {
  mode: HeroMode;
  glitch?: number;
  dive?: number;
  wipe?: number;
};

const SoftShadow: React.FC<{ opacity?: number }> = ({ opacity = 0.55 }) => (
  <div
    style={{
      position: "absolute",
      bottom: -28,
      left: "50%",
      width: 280,
      height: 36,
      transform: "translateX(-50%)",
      background: "radial-gradient(ellipse, rgba(0,0,0,0.55), transparent 70%)",
      opacity,
      filter: "blur(6px)",
    }}
  />
);

const ChaosScreen: React.FC<{ t: number }> = ({ t }) => {
  const msgs = [
    { side: "l", text: "وای‌فای وصل نمیشه" },
    { side: "r", text: "دوباره امتحان کن..." },
    { side: "l", text: "VPN؟ پلی؟ بک‌آپ؟" },
    { side: "r", text: "صبر کن دستی بزنم" },
  ];
  return (
    <div
      style={{
        height: "100%",
        padding: "28px 18px",
        background: "linear-gradient(180deg, #1a1430 0%, #0f0c1c 100%)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontFamily: fonts.en,
          fontSize: 11,
          letterSpacing: "0.2em",
          color: colors.danger,
          opacity: 0.9,
        }}
      >
        MANUAL CHAOS
      </div>
      {msgs.map((m, i) => {
        const appear = interpolate(t, [0.15 + i * 0.18, 0.35 + i * 0.18], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease.outQuint,
        });
        return (
          <div
            key={i}
            style={{
              alignSelf: m.side === "l" ? "flex-start" : "flex-end",
              background:
                m.side === "l"
                  ? "rgba(255,90,122,0.18)"
                  : "rgba(108,71,255,0.22)",
              border: `1px solid ${
                m.side === "l"
                  ? "rgba(255,90,122,0.35)"
                  : "rgba(108,71,255,0.4)"
              }`,
              borderRadius: 16,
              padding: "10px 14px",
              fontFamily: fonts.fa,
              fontSize: 15,
              fontWeight: 600,
              color: colors.white,
              opacity: appear,
              transform: `translateY(${(1 - appear) * 12}px)`,
              maxWidth: "88%",
              direction: "rtl",
            }}
          >
            {m.text}
          </div>
        );
      })}
    </div>
  );
};

const DemoScreen: React.FC<{ t: number }> = ({ t }) => {
  const steps = [
    { label: "USB وصل شد", detail: "ADB ready", doneAt: 0.8 },
    { label: "وای‌فای مغازه", detail: "SSID متصل", doneAt: 2.0 },
    { label: "نصب از پلی", detail: "تلگرام در صف", doneAt: 3.4 },
    { label: "بک‌آپ رسانه", detail: "Desktop/Fixo-Backups", doneAt: 5.0 },
  ];

  return (
    <div
      style={{
        height: "100%",
        padding: "24px 16px",
        background: "linear-gradient(165deg, #16102c 0%, #0c0a18 100%)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          direction: "rtl",
        }}
      >
        <div
          style={{
            fontFamily: fonts.fa,
            fontWeight: 800,
            fontSize: 20,
            color: colors.white,
          }}
        >
          Fixo
        </div>
        <div
          style={{
            fontFamily: fonts.en,
            fontSize: 11,
            color: colors.cyan,
            letterSpacing: "0.12em",
          }}
        >
          AGENT
        </div>
      </div>

      {steps.map((s, i) => {
        const loading = t >= s.doneAt - 0.7 && t < s.doneAt;
        const done = t >= s.doneAt;
        const show = t >= s.doneAt - 0.85;
        const enter = interpolate(
          t,
          [s.doneAt - 0.85, s.doneAt - 0.55],
          [0, 1],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease.outQuint,
          },
        );
        if (!show) return null;
        return (
          <div
            key={i}
            style={{
              borderRadius: 18,
              border: `1px solid ${
                done ? "rgba(34,211,238,0.45)" : colors.cardBorder
              }`,
              background: done
                ? "linear-gradient(120deg, rgba(108,71,255,0.28), rgba(34,211,238,0.16))"
                : "rgba(255,255,255,0.04)",
              padding: "12px 14px",
              opacity: enter,
              transform: `translateY(${(1 - enter) * 16}px) scale(${
                0.96 + enter * 0.04
              })`,
              boxShadow: done
                ? "0 0 24px rgba(34,211,238,0.18)"
                : "none",
              direction: "rtl",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: fonts.fa,
                    fontWeight: 700,
                    fontSize: 16,
                    color: colors.white,
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontFamily: fonts.en,
                    fontSize: 12,
                    color: colors.whiteMuted,
                    marginTop: 4,
                    direction: "ltr",
                    textAlign: "right",
                  }}
                >
                  {loading ? "..." : s.detail}
                </div>
              </div>
              {loading && (
                <div
                  style={{
                    width: 42,
                    height: 10,
                    borderRadius: 6,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      width: `${interpolate(
                        t,
                        [s.doneAt - 0.7, s.doneAt],
                        [12, 100],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                          easing: ease.inOutQuint,
                        },
                      )}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, ${colors.purple}, ${colors.cyan})`,
                    }}
                  />
                </div>
              )}
              {done && (
                <div
                  style={{
                    fontFamily: fonts.en,
                    fontSize: 11,
                    fontWeight: 700,
                    color: colors.navy,
                    background: colors.cyan,
                    borderRadius: 999,
                    padding: "4px 10px",
                    transform: `scale(${interpolate(
                      t,
                      [s.doneAt, s.doneAt + 0.22],
                      [0.6, 1],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                        easing: ease.overshoot,
                      },
                    )})`,
                  }}
                >
                  DONE
                </div>
              )}
            </div>
          </div>
        );
      })}

      {t >= 5.6 && (
        <div
          style={{
            marginTop: "auto",
            alignSelf: "center",
            fontFamily: fonts.fa,
            fontWeight: 900,
            fontSize: 22,
            color: colors.navy,
            background: `linear-gradient(90deg, ${colors.purple}, ${colors.cyan})`,
            borderRadius: 16,
            padding: "10px 22px",
            transform: `scale(${interpolate(t, [5.6, 5.85], [0.5, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: ease.overshoot,
            })}) rotate(${interpolate(t, [5.6, 5.85], [-8, -2], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}deg)`,
            boxShadow: "0 12px 40px rgba(108,71,255,0.45)",
          }}
        >
          نتیجه: میز تمیز شد
        </div>
      )}
    </div>
  );
};

const StatsScreen: React.FC<{ t: number }> = ({ t }) => {
  const barA = interpolate(t, [0.4, 1.4], [8, 32], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease.outQuint,
  });
  const barB = interpolate(t, [0.55, 1.7], [12, 92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease.outQuint,
  });

  return (
    <div
      style={{
        height: "100%",
        padding: "28px 18px",
        background: "linear-gradient(180deg, #141026 0%, #0a0814 100%)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        direction: "rtl",
      }}
    >
      <div
        style={{
          fontFamily: fonts.en,
          fontSize: 12,
          letterSpacing: "0.22em",
          color: colors.cyan,
        }}
      >
        ONE DESK
      </div>
      <div
        style={{
          fontFamily: fonts.en,
          fontWeight: 800,
          fontSize: 96,
          lineHeight: 0.9,
          background: `linear-gradient(135deg, ${colors.purple}, ${colors.cyan})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          transform: `scale(${interpolate(t, [0, 0.45], [0.7, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease.overshoot,
          })})`,
        }}
      >
        7
      </div>
      <div
        style={{
          fontFamily: fonts.fa,
          fontWeight: 700,
          fontSize: 22,
          color: colors.white,
        }}
      >
        کار روزمره روی یک میز
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
        {[
          { label: "دستی / پراکنده", w: barA, color: colors.danger },
          { label: "Fixo Agent", w: barB, color: colors.cyan },
        ].map((row) => (
          <div key={row.label}>
            <div
              style={{
                fontFamily: fonts.fa,
                fontSize: 13,
                fontWeight: 600,
                color: colors.whiteMuted,
                marginBottom: 6,
              }}
            >
              {row.label}
            </div>
            <div
              style={{
                height: 14,
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${row.w}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: row.color,
                  boxShadow: `0 0 16px ${row.color}66`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "auto",
          fontFamily: fonts.fa,
          fontSize: 12,
          color: colors.whiteMuted,
          opacity: interpolate(t, [1.8, 2.2], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        منبع: README فیکسو — ۷ بخش قابلیت
      </div>
    </div>
  );
};

const CardScreen: React.FC<{ t: number; wipe: number }> = ({ t, wipe }) => {
  const reveal = Math.max(wipe, interpolate(t, [0, 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease.outQuint,
  }));

  return (
    <div
      style={{
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(145deg, #1a1240 0%, #0d0a1c 55%, #102832 100%)",
        padding: "28px 20px",
        direction: "rtl",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(90deg, transparent ${reveal * 100 - 12}%, rgba(244,242,251,0.55) ${reveal * 100}%, transparent ${reveal * 100 + 12}%)`,
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          opacity: reveal,
          transform: `translateX(${(1 - reveal) * 40}px)`,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            background: `linear-gradient(135deg, ${colors.purple}, ${colors.cyan})`,
            display: "grid",
            placeItems: "center",
            fontFamily: fonts.en,
            fontWeight: 800,
            fontSize: 22,
            color: colors.navy,
            boxShadow: "0 12px 36px rgba(108,71,255,0.45)",
          }}
        >
          Fx
        </div>
        <div
          style={{
            fontFamily: fonts.en,
            fontWeight: 800,
            fontSize: 36,
            color: colors.white,
          }}
        >
          Fixo
        </div>
        <div
          style={{
            fontFamily: fonts.fa,
            fontWeight: 600,
            fontSize: 16,
            color: colors.whiteMuted,
            lineHeight: 1.5,
          }}
        >
          میزکار هوش‌مصنوعی برای کانتر تعمیرات اندروید
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Chip>Private</Chip>
          <Chip>FA + EN</Chip>
          <Chip>★ Bench</Chip>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {["ADB", "Wi-Fi", "VPN", "Backup", "Agent"].map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
        <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
          <Platform>Desktop</Platform>
          <Platform>Android</Platform>
        </div>
      </div>
    </div>
  );
};

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      fontFamily: fonts.en,
      fontSize: 12,
      fontWeight: 600,
      color: colors.cyan,
      border: `1px solid ${colors.cyan}66`,
      borderRadius: 999,
      padding: "5px 12px",
      background: "rgba(34,211,238,0.08)",
    }}
  >
    {children}
  </span>
);

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      fontFamily: fonts.en,
      fontSize: 12,
      fontWeight: 500,
      color: colors.white,
      borderRadius: 12,
      padding: "6px 12px",
      background: "rgba(255,255,255,0.06)",
      border: `1px solid ${colors.cardBorder}`,
    }}
  >
    {children}
  </span>
);

const Platform: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      fontFamily: fonts.en,
      fontSize: 12,
      fontWeight: 700,
      color: colors.navy,
      borderRadius: 12,
      padding: "8px 14px",
      background: `linear-gradient(90deg, ${colors.purple}, ${colors.cyan})`,
    }}
  >
    {children}
  </span>
);

const FollowScreen: React.FC<{ t: number }> = ({ t }) => {
  const tap = interpolate(t, [2.1, 2.35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease.overshoot,
  });
  const press = interpolate(t, [2.35, 2.5, 2.7], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease.inOutQuint,
  });

  return (
    <div
      style={{
        height: "100%",
        padding: "32px 20px",
        background: "linear-gradient(180deg, #15102c 0%, #0b0916 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: fonts.en,
          fontSize: 13,
          color: colors.cyan,
          letterSpacing: "0.08em",
          direction: "ltr",
          background: "rgba(34,211,238,0.1)",
          border: `1px solid ${colors.cyan}55`,
          borderRadius: 999,
          padding: "8px 16px",
        }}
      >
        github.com/yasinfallahati/fixo
      </div>

      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 28,
          background: `linear-gradient(135deg, ${colors.purple}, ${colors.cyan})`,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 16px 48px rgba(108,71,255,0.5)",
          transform: `scale(${interpolate(t, [0.2, 0.55], [0.7, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease.overshoot,
          })})`,
        }}
      >
        <span
          style={{
            fontFamily: fonts.fa,
            fontWeight: 900,
            fontSize: 28,
            color: colors.navy,
          }}
        >
          نبض
        </span>
      </div>

      <div
        style={{
          fontFamily: fonts.fa,
          fontWeight: 800,
          fontSize: 24,
          color: colors.white,
        }}
      >
        نبض فردا رو دنبال کن
      </div>

      <div style={{ position: "relative" }}>
        <div
          style={{
            fontFamily: fonts.en,
            fontWeight: 800,
            fontSize: 18,
            color: colors.navy,
            background: colors.white,
            borderRadius: 14,
            padding: "12px 36px",
            transform: `scale(${1 - press * 0.08})`,
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          }}
        >
          Follow
        </div>
        <div
          style={{
            position: "absolute",
            right: -18,
            bottom: -28,
            width: 44,
            height: 56,
            opacity: tap,
            transform: `translate(${(1 - tap) * 30}px, ${(1 - tap) * 40}px) scale(${
              0.8 + tap * 0.2
            })`,
            filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.4))",
          }}
        >
          {/* finger tip */}
          <svg viewBox="0 0 44 56" width="44" height="56">
            <path
              d="M18 2c4 0 7 3 7 7v18l8 4c3 1.5 4 5 2.5 8L28 54H12l-4-16c-1-4 1-8 5-9l5-2V9c0-4 3-7 7-7z"
              fill={colors.white}
              stroke={colors.purple}
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export const HeroPhone: React.FC<Props> = ({
  mode,
  glitch = 0,
  dive = 0,
  wipe = 0,
}) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;

  const floatY = Math.sin(t * 1.1) * 10;
  const driftRot = Math.sin(t * 0.55) * 2.2 + Math.cos(t * 0.35) * 1.1;
  const handZoom = 1 + Math.sin(t * 0.28) * 0.012;

  const modeScale =
    mode === "stats"
      ? interpolate(dive, [0, 1], [1, 1.32], { easing: ease.inCubic })
      : mode === "card"
        ? 1.02
        : mode === "follow"
          ? 1.04
          : 1;

  const blurFast = mode === "stats" && dive > 0.2 && dive < 0.85 ? 1.8 : 0;

  const glass = `inset 0 1px 0 rgba(255,255,255,0.22), 0 30px 80px rgba(0,0,0,0.55), 0 0 40px rgba(108,71,255,0.18)`;

  const demoT = Math.max(0, t - Acts.demo.start);
  const statsT = Math.max(0, t - Acts.numbers.start);
  const cardT = Math.max(0, t - Acts.card.start);
  const followT = Math.max(0, t - Acts.outro.start);

  return (
    <AbsoluteFill
      style={{
        perspective: 1400,
        perspectiveOrigin: "50% 45%",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: mode === "chaos" || mode === "demo" ? 980 : mode === "stats" ? 720 : 900,
          width: 360,
          height: 720,
          transform: `
            translate(-50%, -50%)
            translateY(${floatY}px)
            rotateY(${driftRot + (mode === "card" ? -8 : 0)}deg)
            rotateX(${4 + dive * -12}deg)
            scale(${handZoom * modeScale})
          `,
          transformStyle: "preserve-3d",
          filter: `blur(${blurFast}px)`,
          transition: "none",
        }}
      >
        <SoftShadow opacity={0.5 + dive * 0.2} />

        {/* phone body */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 48,
            background: "linear-gradient(145deg, #2a2440, #12101c 40%, #1a2230)",
            border: "1px solid rgba(244,242,251,0.18)",
            boxShadow: glass,
            overflow: "hidden",
            transform: `translate(${glitch * 6}px, ${glitch * -3}px)`,
          }}
        >
          {/* glass sheen */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(115deg, rgba(255,255,255,0.16) 0%, transparent 32%, transparent 60%, rgba(34,211,238,0.08) 100%)",
              pointerEvents: "none",
              zIndex: 5,
            }}
          />

          {/* notch */}
          <div
            style={{
              position: "absolute",
              top: 14,
              left: "50%",
              transform: "translateX(-50%)",
              width: 110,
              height: 22,
              borderRadius: 20,
              background: "#05040a",
              zIndex: 6,
            }}
          />

          {/* screen */}
          <div
            style={{
              position: "absolute",
              top: 18,
              left: 12,
              right: 12,
              bottom: 18,
              borderRadius: 36,
              overflow: "hidden",
              background: colors.navy,
              transform: `skewX(${glitch * 2}deg)`,
              filter: glitch > 0.1 ? `hue-rotate(${glitch * 40}deg) contrast(1.2)` : undefined,
            }}
          >
            {mode === "chaos" && <ChaosScreen t={t} />}
            {mode === "demo" && <DemoScreen t={demoT} />}
            {mode === "stats" && <StatsScreen t={statsT} />}
            {mode === "card" && <CardScreen t={cardT} wipe={wipe} />}
            {mode === "follow" && <FollowScreen t={followT} />}

            {glitch > 0.05 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 3px,
                    rgba(34,211,238,${0.15 * glitch}) 3px,
                    rgba(34,211,238,${0.15 * glitch}) 6px
                  )`,
                  mixBlendMode: "screen",
                  opacity: glitch,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
