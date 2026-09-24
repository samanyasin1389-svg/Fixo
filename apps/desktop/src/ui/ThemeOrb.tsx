import { useId, useState } from "react";
import type { Theme } from "./i18n";

type ThemeOrbProps = {
  theme: Theme;
  onChange: (theme: Theme) => void;
  label: string;
  labels: { night: string; day: string; galaxy: string };
};

const SWATCHES: { id: Theme; className: string }[] = [
  { id: "galaxy", className: "orb-swatch galaxy" },
  { id: "day", className: "orb-swatch day" },
  { id: "night", className: "orb-swatch night" },
];

export function ThemeOrb({ theme, onChange, label, labels }: ThemeOrbProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  return (
    <div
      className={`theme-orb-wrap${open ? " open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className={`theme-orb core theme-${theme}`}
        aria-label={label}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="theme-orb-spin" aria-hidden="true" />
      </button>
      <div id={menuId} className="theme-orb-menu" role="menu" aria-label={label}>
        {SWATCHES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="menuitemradio"
            aria-checked={theme === s.id}
            className={`${s.className}${theme === s.id ? " active" : ""}`}
            title={labels[s.id]}
            onClick={() => {
              onChange(s.id);
              setOpen(false);
            }}
          >
            <span className="visually-hidden">{labels[s.id]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
