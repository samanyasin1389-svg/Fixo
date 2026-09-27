import type { Locale } from "../i18n";
import { t } from "../i18n";
import { CATEGORY_ICONS, IconSettings } from "../icons";

export type PhoneSettingCategory = {
  id: string;
  titleFa: string;
  titleEn: string;
};

export type PhoneSettingIssue = {
  id: string;
  categoryId: string;
  titleFa: string;
  titleEn: string;
  kind: "detect" | "fix" | "guide";
  stepsFa: string[];
  detectKey?: string;
  fixKey?: string;
};

export type PhoneDetectState = {
  issueId: string;
  status: "ok" | "problem" | "unknown";
  message: string;
};

type Props = {
  locale: Locale;
  open: boolean;
  onOpen: (v: boolean) => void;
  categories: PhoneSettingCategory[];
  issues: PhoneSettingIssue[];
  activeCategory: string;
  onCategory: (id: string) => void;
  detectMap: Record<string, PhoneDetectState>;
  busy: boolean;
  onDetect: (issueId: string) => void;
  onFix: (issueId: string) => void;
};

export function PhoneSettingsPanel(props: Props) {
  const {
    locale,
    open,
    categories,
    issues,
    activeCategory,
    detectMap,
    busy,
  } = props;

  const filtered = issues.filter((i) => i.categoryId === activeCategory);
  const isFa = locale === "fa";

  return (
    <div className="section-gap">
      <button
        type="button"
        className="disclosure"
        onClick={() => props.onOpen(!open)}
      >
        <span className="disclosure-with-icon">
          <IconSettings size={18} />
          <span>{t(locale, "phoneSettingsSection")}</span>
        </span>
        <span className="chevron">{open ? "▾" : "◂"}</span>
      </button>
      {open ? (
        <div className="vpn-body phone-settings">
          <p className="muted tiny">{t(locale, "phoneSettingsHint")}</p>
          <div className="source-list phone-cat-list">
            {categories.map((c) => {
              const Icon = CATEGORY_ICONS[c.id] ?? IconSettings;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={
                    activeCategory === c.id
                      ? "source-btn phone-cat-btn active"
                      : "source-btn phone-cat-btn"
                  }
                  onClick={() => props.onCategory(c.id)}
                >
                  <Icon size={18} />
                  <span>{isFa ? c.titleFa : c.titleEn}</span>
                </button>
              );
            })}
          </div>
          <div className="phone-issue-list">
            {filtered.map((issue) => {
              const det = detectMap[issue.id];
              return (
                <div key={issue.id} className="phone-issue">
                  <p className="muted">
                    {isFa ? issue.titleFa : issue.titleEn}
                    {issue.kind !== "guide" ? (
                      <span className="muted tiny"> · {issue.kind}</span>
                    ) : null}
                  </p>
                  {det ? (
                    <p
                      className={
                        det.status === "problem"
                          ? "muted tiny danger"
                          : "muted tiny"
                      }
                    >
                      {det.message}
                    </p>
                  ) : null}
                  <ul className="muted tiny">
                    {issue.stepsFa.slice(0, 4).map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  <div className="actions">
                    {issue.detectKey ? (
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => props.onDetect(issue.id)}
                      >
                        {t(locale, "phoneSettingsDetect")}
                      </button>
                    ) : null}
                    {issue.fixKey ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => props.onFix(issue.id)}
                      >
                        {t(locale, "phoneSettingsFix")}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 ? (
              <p className="muted tiny">{t(locale, "phoneSettingsEmpty")}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
