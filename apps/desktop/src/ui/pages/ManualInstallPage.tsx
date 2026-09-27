import type { Locale } from "../i18n";
import { t } from "../i18n";
import { SubPageShell } from "./SubPageShell";
import type { CatalogApp } from "./BenchPage";

type ManualSource = "model_search" | "local_apk" | "github" | "url";

type Props = {
  locale: Locale;
  manualSource: ManualSource;
  manualTargets: CatalogApp[];
  manualSourceOptions: { id: ManualSource; label: string }[];
  busy: boolean;
  onManualSource: (v: ManualSource) => void;
  onRunManual: () => void;
};

export function ManualInstallPage(props: Props) {
  const { locale, manualSource, manualTargets, manualSourceOptions, busy } = props;

  return (
    <SubPageShell locale={locale} title={t(locale, "manualInstall")}>
      <div className="apps-body manual-box">
        <p className="muted">{t(locale, "manualInstallHint")}</p>
        {manualTargets.length ? (
          <p className="muted tiny">
            {manualTargets.map((a) => a.label).join(" · ")}
          </p>
        ) : null}
        <div className="source-list">
          {manualSourceOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={manualSource === opt.id ? "source-btn active" : "source-btn"}
              onClick={() => props.onManualSource(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="actions">
          <button type="button" disabled={busy} onClick={() => props.onRunManual()}>
            {t(locale, "runManual")}
          </button>
        </div>
      </div>
    </SubPageShell>
  );
}
