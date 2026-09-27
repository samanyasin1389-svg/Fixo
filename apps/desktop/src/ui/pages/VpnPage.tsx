import type { Locale } from "../i18n";
import { t } from "../i18n";
import { SubPageShell } from "./SubPageShell";

export type VpnFormState = {
  query: string;
  phone: string;
  days: string;
  gigabytes: string;
};

export type VpnResultState = {
  username?: string;
  status?: string;
  action?: string;
  subscriptionUrl?: string;
  message?: string;
  remainingGb?: number | null;
  usedGb?: number | null;
  totalGb?: number | null;
  remainingDays?: number | null;
  expired?: boolean;
  shopId?: string | null;
  phone?: string | null;
} | null;

type Props = {
  locale: Locale;
  vpnForm: VpnFormState;
  vpnLookupFound: boolean | null;
  vpnResult: VpnResultState;
  busy: boolean;
  onVpnForm: (patch: Partial<VpnFormState>) => void;
  onLookupVpn: () => void;
  onProvisionVpn: () => void;
  onCopyVpnLink: () => void;
  onDeleteVpn: () => void;
};

export function VpnPage(props: Props) {
  const { locale, vpnForm, vpnLookupFound, vpnResult, busy } = props;

  return (
    <SubPageShell locale={locale} title={t(locale, "vpnSection")}>
      <div className="vpn-body">
        <p className="muted tiny">{t(locale, "vpnLookupHint")}</p>
        <input
          className="field"
          placeholder={t(locale, "vpnQuery")}
          value={vpnForm.query}
          onChange={(e) => props.onVpnForm({ query: e.target.value })}
          inputMode="tel"
        />
        <button
          type="button"
          className="secondary"
          disabled={busy || !vpnForm.query.trim()}
          onClick={() => props.onLookupVpn()}
        >
          {t(locale, "vpnLookup")}
        </button>

        {vpnResult && vpnLookupFound ? (
          <div className="vpn-result">
            <p className="muted">
              {t(locale, "vpnAssignedUser")}: {vpnResult.username}
              {vpnResult.shopId ? ` (${vpnResult.shopId})` : ""}
            </p>
            <p className="muted">
              {t(locale, "vpnStatus")}: {vpnResult.status ?? "—"}
              {vpnResult.expired ? ` — ${t(locale, "vpnExpired")}` : ""}
              {vpnResult.action ? ` (${vpnResult.action})` : ""}
            </p>
            <p className="muted tiny">
              {t(locale, "vpnQuota")}: {vpnResult.usedGb ?? "—"} / {vpnResult.totalGb ?? "—"}{" "}
              {t(locale, "vpnGb")} · {t(locale, "vpnRemaining")}: {vpnResult.remainingGb ?? "—"}{" "}
              {t(locale, "vpnGb")}
            </p>
            <p className="muted tiny">
              {t(locale, "vpnDaysLeft")}:{" "}
              {vpnResult.expired
                ? t(locale, "vpnExpired")
                : vpnResult.remainingDays != null
                  ? `${vpnResult.remainingDays}`
                  : "—"}
            </p>
            {vpnResult.message ? (
              <p className="muted tiny">{vpnResult.message}</p>
            ) : null}
            {vpnResult.subscriptionUrl ? (
              <p className="muted tiny">{vpnResult.subscriptionUrl}</p>
            ) : null}
            <div className="actions">
              {vpnResult.subscriptionUrl ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => props.onCopyVpnLink()}
                >
                  {t(locale, "vpnCopyLink")}
                </button>
              ) : null}
              <button
                type="button"
                className="secondary"
                disabled={busy || !vpnResult.username}
                onClick={() => props.onDeleteVpn()}
              >
                {t(locale, "vpnDelete")}
              </button>
            </div>
          </div>
        ) : null}

        <p className="muted tiny">
          {vpnLookupFound === false
            ? t(locale, "vpnNotFoundCreate")
            : vpnLookupFound
              ? t(locale, "vpnRenew")
              : t(locale, "vpnCreateHint")}
        </p>
        {!vpnLookupFound ? (
          <input
            className="field"
            placeholder={t(locale, "vpnPhoneOptional")}
            value={vpnForm.phone}
            onChange={(e) => props.onVpnForm({ phone: e.target.value })}
            inputMode="tel"
          />
        ) : null}
        <div className="suggest-chips">
          <button
            type="button"
            className="secondary chip"
            onClick={() => props.onVpnForm({ days: "30", gigabytes: "30" })}
          >
            {t(locale, "vpnSuggest30")}
          </button>
          <button
            type="button"
            className="secondary chip"
            onClick={() => props.onVpnForm({ days: "30", gigabytes: "50" })}
          >
            {t(locale, "vpnSuggest50")}
          </button>
          <button
            type="button"
            className="secondary chip"
            onClick={() => props.onVpnForm({ days: "90", gigabytes: "100" })}
          >
            {t(locale, "vpnSuggest100")}
          </button>
        </div>
        <input
          className="field"
          type="number"
          min={1}
          placeholder={t(locale, "vpnDays")}
          value={vpnForm.days}
          onChange={(e) => props.onVpnForm({ days: e.target.value })}
        />
        <input
          className="field"
          type="number"
          min={1}
          placeholder={t(locale, "vpnGigabytes")}
          value={vpnForm.gigabytes}
          onChange={(e) => props.onVpnForm({ gigabytes: e.target.value })}
        />
        <button
          type="button"
          disabled={busy || !vpnForm.days.trim() || !vpnForm.gigabytes.trim()}
          onClick={() => props.onProvisionVpn()}
        >
          {vpnLookupFound ? t(locale, "vpnRenew") : t(locale, "vpnProvision")}
        </button>
      </div>
    </SubPageShell>
  );
}
