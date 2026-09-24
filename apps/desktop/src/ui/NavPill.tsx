import type { AppTab } from "./i18n";
import { TAB_ORDER } from "./i18n";

type NavPillProps = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
  labels: Record<AppTab, string>;
  dir: "rtl" | "ltr";
};

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3.2 3.5 10.2c-.3.25-.2.7.2.7H6v8.1c0 .4.3.7.7.7h3.1c.4 0 .7-.3.7-.7V14h2.9v4.3c0 .4.3.7.7.7h3.1c.4 0 .7-.3.7-.7v-8.1h2.3c.4 0 .5-.45.2-.7L12 3.2z"
      />
    </svg>
  );
}

function IconAgent() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4.5 5.5A2.5 2.5 0 0 1 7 3h10a2.5 2.5 0 0 1 2.5 2.5V14A2.5 2.5 0 0 1 17 16.5H9.2L5.6 19.4c-.45.35-1.1.05-1.1-.5V5.5z"
      />
    </svg>
  );
}

function IconBench() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.5 3.5h9a1 1 0 0 1 1 1V7H6.5V4.5a1 1 0 0 1 1-1zm-1 5.5h11v2.2l-1.4 1.1v6.2a1 1 0 0 1-1 1h-6.2a1 1 0 0 1-1-1v-6.2L6.5 11.2V9z"
      />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6zm8.1 2.5-1.55-.35a6.8 6.8 0 0 0-.55-1.3l.9-1.3-1.7-1.7-1.3.9c-.4-.22-.85-.4-1.3-.55L13.3 3.9h-2.6l-.35 1.55c-.45.15-.9.33-1.3.55l-1.3-.9-1.7 1.7.9 1.3c-.22.4-.4.85-.55 1.3L3.9 10.7v2.6l1.55.35c.15.45.33.9.55 1.3l-.9 1.3 1.7 1.7 1.3-.9c.4.22.85.4 1.3.55l.35 1.55h2.6l.35-1.55c.45-.15.9-.33 1.3-.55l1.3.9 1.7-1.7-.9-1.3c.22-.4.4-.85.55-1.3l1.55-.35v-2.6z"
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
