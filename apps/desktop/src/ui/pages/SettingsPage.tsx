import type { Locale, Theme } from "../i18n";
import { t } from "../i18n";
import { ThemeFanButton } from "../ThemeFanButton";

type SettingsPageProps = {
  locale: Locale;
  theme: Theme;
  shopSsid: string;
  shopPassword: string;
  hasShopWifiPassword: boolean;
  settingsMsg: string | null;
  busy: boolean;
  onTheme: (theme: Theme) => void;
  onLocale: (locale: Locale) => void;
  onShopSsid: (v: string) => void;
  onShopPassword: (v: string) => void;
  onSave: () => void;
};

export function SettingsPage({
  locale,
  theme,
  shopSsid,
  shopPassword,
  hasShopWifiPassword,
  settingsMsg,
  busy,
  onTheme,
  onLocale,
  onShopSsid,
  onShopPassword,
  onSave,
}: SettingsPageProps) {
  return (
    <section className="panel settings-stack">
      <div>
        <p className="settings-label">{t(locale, "settingsTheme")}</p>
        <div className="settings-row">
          <ThemeFanButton
            theme={theme}
            label={t(locale, "themePicker")}
            labels={{
              galaxy: t(locale, "themeGalaxy"),
              emerald: t(locale, "themeEmerald"),
              ice: t(locale, "themeIce"),
            }}
            onChange={onTheme}
          />
          <span className="muted">
            {theme === "galaxy"
              ? t(locale, "themeGalaxy")
              : theme === "emerald"
                ? t(locale, "themeEmerald")
                : t(locale, "themeIce")}
          </span>
        </div>
      </div>

      <div>
        <p className="settings-label">{t(locale, "settingsLanguage")}</p>
        <div className="toggle-group" role="group" aria-label="language">
          <button
            type="button"
            className={locale === "fa" ? "active" : "secondary"}
            onClick={() => onLocale("fa")}
          >
            {t(locale, "langFa")}
          </button>
          <button
            type="button"
            className={locale === "en" ? "active" : "secondary"}
            onClick={() => onLocale("en")}
          >
            {t(locale, "langEn")}
          </button>
        </div>
      </div>

      <div>
        <p className="settings-label">{t(locale, "settingsWifi")}</p>
        <div className="settings-box" style={{ marginTop: 0 }}>
          <input
            className="field"
            value={shopSsid}
            onChange={(e) => onShopSsid(e.target.value)}
            placeholder={t(locale, "ssid")}
          />
          <input
            className="field"
            type="password"
            value={shopPassword}
            onChange={(e) => onShopPassword(e.target.value)}
            placeholder={
              hasShopWifiPassword ? t(locale, "passwordNew") : t(locale, "passwordShop")
            }
          />
          <button type="button" disabled={busy} onClick={onSave}>
            {t(locale, "save")}
          </button>
          {settingsMsg ? <p className="muted">{settingsMsg}</p> : null}
        </div>
      </div>
    </section>
  );
}
