import type { Locale } from "../i18n";
import { t } from "../i18n";
import { SubPageShell } from "./SubPageShell";

export type GmailFormState = {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
};

export type GmailResultState = {
  emailHint?: string | null;
  password?: string;
  message?: string;
  notePath?: string;
  humanNext?: string[];
  filled?: string[];
} | null;

type Props = {
  locale: Locale;
  gmailForm: GmailFormState;
  gmailResult: GmailResultState;
  selectedSerial: string;
  busy: boolean;
  onGmailForm: (patch: Partial<GmailFormState>) => void;
  onAssistGmail: () => void;
  onCopyGmailPassword: () => void;
};

export function GmailPage(props: Props) {
  const { locale, gmailForm, gmailResult, selectedSerial, busy } = props;

  return (
    <SubPageShell locale={locale} title={t(locale, "gmailSection")}>
      <div className="vpn-body">
        <p className="muted tiny">{t(locale, "gmailHint")}</p>
        <input
          className="field"
          placeholder={t(locale, "gmailFirstName")}
          value={gmailForm.firstName}
          onChange={(e) => props.onGmailForm({ firstName: e.target.value })}
        />
        <input
          className="field"
          placeholder={t(locale, "gmailLastName")}
          value={gmailForm.lastName}
          onChange={(e) => props.onGmailForm({ lastName: e.target.value })}
        />
        <input
          className="field"
          placeholder={t(locale, "gmailUsername")}
          value={gmailForm.username}
          onChange={(e) => props.onGmailForm({ username: e.target.value })}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <input
          className="field"
          placeholder={t(locale, "gmailPasswordOptional")}
          value={gmailForm.password}
          onChange={(e) => props.onGmailForm({ password: e.target.value })}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          disabled={busy || !selectedSerial}
          onClick={() => props.onAssistGmail()}
        >
          {t(locale, "gmailAssist")}
        </button>
        {gmailResult ? (
          <div className="vpn-result">
            {gmailResult.message ? (
              <p className="muted tiny">{gmailResult.message}</p>
            ) : null}
            {gmailResult.emailHint ? (
              <p className="muted">
                {t(locale, "gmailEmail")}: {gmailResult.emailHint}
              </p>
            ) : null}
            {gmailResult.password ? (
              <div className="actions">
                <p className="muted tiny">
                  {t(locale, "gmailPassword")}: {gmailResult.password}
                </p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => props.onCopyGmailPassword()}
                >
                  {t(locale, "gmailCopyPassword")}
                </button>
              </div>
            ) : null}
            {gmailResult.notePath ? (
              <p className="muted tiny">
                {t(locale, "gmailNoteSaved")}: {gmailResult.notePath}
              </p>
            ) : null}
            {gmailResult.humanNext?.length ? (
              <ul className="muted tiny">
                {gmailResult.humanNext.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </SubPageShell>
  );
}
