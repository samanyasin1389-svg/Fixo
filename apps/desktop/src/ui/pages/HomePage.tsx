import type { AppTab, Locale } from "../i18n";
import { t } from "../i18n";

type HomePageProps = {
  locale: Locale;
  phoneConnected: boolean;
  deviceCount: number;
  wifiSsid: string | null | undefined;
  shopSsid: string;
  onGo: (tab: AppTab) => void;
};

export function HomePage({
  locale,
  phoneConnected,
  deviceCount,
  wifiSsid,
  shopSsid,
  onGo,
}: HomePageProps) {
  return (
    <section className="panel home-hero">
      <h2>{t(locale, "homeWelcome")}</h2>
      <p className="muted">{t(locale, "homeHint")}</p>
      <div className="status-card">
        <div className="status-row">
          <span>ADB</span>
          <span className="pill unknown">{deviceCount}</span>
        </div>
        <div className="status-row">
          <span>{t(locale, phoneConnected ? "connected" : "disconnected")}</span>
          <span className={phoneConnected ? "pill on" : "pill off"}>
            {phoneConnected ? "ON" : "OFF"}
          </span>
        </div>
        <div className="status-row">
          <span>{t(locale, "network")}</span>
          <span className="pill unknown">{wifiSsid || shopSsid || "—"}</span>
        </div>
      </div>
      <div className="home-shortcuts">
        <button type="button" className="home-shortcut" onClick={() => onGo("agent")}>
          <span>{t(locale, "homeGoAgent")}</span>
          <span aria-hidden="true">→</span>
        </button>
        <button type="button" className="home-shortcut" onClick={() => onGo("bench")}>
          <span>{t(locale, "homeGoBench")}</span>
          <span aria-hidden="true">→</span>
        </button>
        <button type="button" className="home-shortcut" onClick={() => onGo("settings")}>
          <span>{t(locale, "homeGoSettings")}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
