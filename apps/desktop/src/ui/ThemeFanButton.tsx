import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { Theme } from "./i18n";

type ThemeFanButtonProps = {
  theme: Theme;
  onChange: (theme: Theme) => void;
  label: string;
  labels: Record<Theme, string>;
};

const SWATCHES: { id: Theme; angle: number }[] = [
  { id: "galaxy", angle: -42 },
  { id: "emerald", angle: 0 },
  { id: "ice", angle: 42 },
];

export function ThemeFanButton({ theme, onChange, label, labels }: ThemeFanButtonProps) {
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setSpinning(true);
    setOpen(true);
    window.setTimeout(() => setSpinning(false), 520);
  }

  return (
    <div
      ref={wrapRef}
      className={`theme-fan${open ? " open" : ""}${spinning ? " spinning" : ""}`}
    >
      <button
        type="button"
        className={`theme-fan-core theme-${theme}${spinning ? " spin" : ""}`}
        aria-label={label}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggle}
      />
      <div id={menuId} className="theme-fan-menu" role="menu" aria-label={label}>
        {SWATCHES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="menuitemradio"
            aria-checked={theme === s.id}
            className={`theme-fan-swatch theme-${s.id}${theme === s.id ? " active" : ""}`}
            style={{ "--fan-angle": `${s.angle}deg` } as CSSProperties}
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
