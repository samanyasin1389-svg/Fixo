import { useEffect, useId, useRef, useState } from "react";
import type { Theme } from "./i18n";

type ThemeFanButtonProps = {
  theme: Theme;
  onChange: (theme: Theme) => void;
  label: string;
  labels: Record<Theme, string>;
};

const SWATCHES: Theme[] = ["galaxy", "emerald", "ice"];

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
      <div id={menuId} className="theme-fan-menu" role="menu" aria-label={label}>
        {SWATCHES.map((id) => (
          <button
            key={id}
            type="button"
            role="menuitemradio"
            aria-checked={theme === id}
            className={`theme-fan-swatch theme-${id}${theme === id ? " active" : ""}`}
            title={labels[id]}
            onClick={() => {
              onChange(id);
              setOpen(false);
            }}
          >
            <span className="visually-hidden">{labels[id]}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`theme-fan-core theme-${theme}${spinning ? " spin" : ""}`}
        aria-label={label}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggle}
      />
    </div>
  );
}
