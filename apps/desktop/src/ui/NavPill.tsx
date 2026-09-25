import type { AppTab } from "./i18n";
import { TAB_ORDER } from "./i18n";

type NavPillProps = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
  labels: Record<AppTab, string>;
  dir: "rtl" | "ltr";
};

/** Outline icons (UI UX Pro Max: SVG not emoji) */
function IconHome() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAgent() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5V14a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 2.8c-.5.35-1.2.02-1.2-.55V6.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBench() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        d="M7 4h10a1 1 0 0 1 1 1v3H6V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M6 10h12l-1.2 1.2v6.3a1 1 0 0 1-1 1H8.2a1 1 0 0 1-1-1v-6.3L6 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M4.9 6.4l1.6 1.6M17.5 16l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.6l1.6-1.6M17.5 8l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

const ICONS: Record<AppTab, () => JSX.Element> = {
  home: IconHome,
  agent: IconAgent,
  bench: IconBench,
  settings: IconSettings,
};

export function NavPill({ active, onChange, labels, dir }: NavPillProps) {
  const index = Math.max(0, TAB_ORDER.indexOf(active));
  const slot = 100 / TAB_ORDER.length;

  return (
    <nav className="nav-pill" aria-label="Fixo navigation" data-dir={dir}>
      <div
        className="nav-pill-thumb"
        style={{
          width: `calc(${slot}% - 6px)`,
          insetInlineStart: `calc(${index * slot}% + 3px)`,
        }}
      />
      {TAB_ORDER.map((tab) => {
        const Icon = ICONS[tab];
        const isActive = tab === active;
        return (
          <button
            key={tab}
            type="button"
            className={`nav-pill-item${isActive ? " active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            aria-label={labels[tab]}
            title={labels[tab]}
            onClick={() => onChange(tab)}
          >
            <Icon />
          </button>
        );
      })}
    </nav>
  );
}
