import type { AppTab } from "./i18n";
import { TAB_ORDER } from "./i18n";
import { IconAgent, IconBench, IconHome, IconSettings } from "./icons";

type NavPillProps = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
  labels: Record<AppTab, string>;
  dir: "rtl" | "ltr";
};

const ICONS: Record<AppTab, (props: { size?: number }) => JSX.Element> = {
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
            <Icon size={22} />
          </button>
        );
      })}
    </nav>
  );
}
