import type { Locale } from "../i18n";
import { t } from "../i18n";

type Device = { serial: string; status: string };
type NetworkStatus = {
  wifiEnabled: boolean | null;
  mobileDataEnabled: boolean | null;
  airplaneMode: boolean | null;
  wifiConnected: boolean | null;
  wifiSsid?: string | null;
};
type CatalogApp = {
  id: string;
  label: string;
  packageId: string;
  sources: {
    play?: boolean;
    localApkPath?: string;
    githubRepo?: string;
    apkUrl?: string;
  };
  pinned?: boolean;
};
type BackupJob = {
  jobId: string;
  phase: string;
  percent: number;
  message: string;
  folder?: string;
  contactsCount?: number;
  currentTarget?: string;
};
type ManualSource = "model_search" | "local_apk" | "github" | "url";

function pillClass(v: boolean | null) {
  if (v === null) return "pill unknown";
  return v ? "pill on" : "pill off";
}

function pillLabel(v: boolean | null) {
  if (v === null) return "—";
  return v ? "ON" : "OFF";
}

export type BenchPageProps = {
  locale: Locale;
  devices: Device[];
  selectedSerial: string;
  network: NetworkStatus | null;
  shopWifiSsid: string;
  catalog: CatalogApp[];
  appsOpen: boolean;
  selectedApps: string[];
  showAddApp: boolean;
  newApp: {
    label: string;
    packageId: string;
    localApkPath: string;
    githubRepo: string;
    apkUrl: string;
  };
  manualOpen: boolean;
  manualSource: ManualSource;
  manualTargets: CatalogApp[];
  manualSourceOptions: { id: ManualSource; label: string }[];
  vpnOpen: boolean;
  vpnForm: { days: string; gigabytes: string };
  vpnResult: {
    username?: string;
    status?: string;
    action?: string;
    subscriptionUrl?: string;
    message?: string;
  } | null;
  backupJob: BackupJob | null;
  busy: boolean;
  actionMsg: string | null;
  error: string | null;
  onDeviceSerial: (v: string) => void;
  onToggleWifi: (enabled: boolean) => void;
  onShopWifiForget: () => void;
  onAppsOpen: (v: boolean) => void;
  onToggleAppSelect: (packageId: string) => void;
  onInstallPlay: (apps: CatalogApp[]) => void;
  onShowAddApp: (v: boolean) => void;
  onNewApp: (patch: Partial<BenchPageProps["newApp"]>) => void;
  onAddCatalogApp: () => void;
  onVpnOpen: (v: boolean) => void;
  onVpnForm: (patch: Partial<BenchPageProps["vpnForm"]>) => void;
  onProvisionVpn: () => void;
  onCopyVpnLink: () => void;
  onDeleteVpn: () => void;
  onManualOpen: (v: boolean) => void;
  onManualSource: (v: ManualSource) => void;
  onRunManual: () => void;
  onStartBackup: () => void;
  onBackupAction: (action: "pause" | "resume" | "cancel") => void;
};

export function BenchPage(props: BenchPageProps) {
  const {
    locale,
    devices,
    selectedSerial,
    network,
    shopWifiSsid,
    catalog,
    appsOpen,
    selectedApps,
    showAddApp,
    newApp,
    manualOpen,
    manualSource,
    manualTargets,
    manualSourceOptions,
    vpnOpen,
    vpnForm,
    vpnResult,
    backupJob,
    busy,
    actionMsg,
    error,
  } = props;

  const pinned = catalog.filter((a) => a.pinned !== false).slice(0, 4);

  return (
    <aside className="panel panel-side">
      <h2>{t(locale, "networkShop")}</h2>
      <div className="status-card">
        <div className="status-row">
          <span>ADB</span>
          <span className="pill unknown">{devices.length}</span>
        </div>
        <div className="status-row">
          <span>{t(locale, "wifi")}</span>
          <span className={pillClass(network?.wifiEnabled ?? null)}>
            {pillLabel(network?.wifiEnabled ?? null)}
          </span>
        </div>
        <div className="status-row">
          <span>{t(locale, "network")}</span>
          <span className="pill unknown">{network?.wifiSsid || "—"}</span>
        </div>
      </div>

      {devices.length > 1 ? (
        <select
          value={selectedSerial}
          onChange={(e) => props.onDeviceSerial(e.target.value)}
          className="field"
        >
          <option value="">{t(locale, "auto")}</option>
          {devices.map((d) => (
            <option key={d.serial} value={d.serial}>
              {d.serial}
            </option>
          ))}
        </select>
      ) : null}

      <div className="actions">
        <button type="button" disabled={busy} onClick={() => props.onToggleWifi(true)}>
          {t(locale, "onPlus")} {shopWifiSsid || "nibero"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => props.onToggleWifi(false)}
        >
          {t(locale, "off")}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => props.onShopWifiForget()}
        >
          {t(locale, "forgetShop")}
        </button>
      </div>
      {actionMsg ? <p className="muted">{actionMsg}</p> : null}

      <div className="section-gap">
        <button
          type="button"
          className="disclosure"
          onClick={() => props.onAppsOpen(!appsOpen)}
        >
          <span>
            {t(locale, "apps")} ({catalog.length})
          </span>
          <span className="chevron">{appsOpen ? "▾" : "◂"}</span>
        </button>

        {appsOpen ? (
          <div className="apps-body">
            <div className="app-grid">
              {(pinned.length ? pinned : catalog.slice(0, 4)).map((app) => (
                <button
                  key={app.packageId}
                  type="button"
                  className="app-btn"
                  disabled={busy}
                  onClick={() => props.onInstallPlay([app])}
                >
                  {app.label}
                </button>
              ))}
            </div>

            <div className="catalog-list">
              {catalog.map((app) => (
                <label key={app.id} className="catalog-row">
                  <input
                    type="checkbox"
                    checked={selectedApps.includes(app.packageId)}
                    onChange={() => props.onToggleAppSelect(app.packageId)}
                  />
                  <span>{app.label}</span>
                  <span className="muted tiny">{app.packageId}</span>
                </label>
              ))}
            </div>

            <div className="actions">
              <button
                type="button"
                disabled={busy || !selectedApps.length}
                onClick={() =>
                  props.onInstallPlay(
                    catalog.filter((a) => selectedApps.includes(a.packageId)),
                  )
                }
              >
                {t(locale, "installSelected")}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => props.onShowAddApp(!showAddApp)}
              >
                {showAddApp ? t(locale, "closeForm") : t(locale, "addApp")}
              </button>
            </div>

            {showAddApp ? (
              <div className="settings-box">
                <input
                  className="field"
                  placeholder={t(locale, "displayName")}
                  value={newApp.label}
                  onChange={(e) => props.onNewApp({ label: e.target.value })}
                />
                <input
                  className="field"
                  placeholder={t(locale, "packageId")}
                  value={newApp.packageId}
                  onChange={(e) => props.onNewApp({ packageId: e.target.value })}
                />
                <input
                  className="field"
                  placeholder={t(locale, "localApkOptional")}
                  value={newApp.localApkPath}
                  onChange={(e) => props.onNewApp({ localApkPath: e.target.value })}
                />
                <input
                  className="field"
                  placeholder={t(locale, "githubOptional")}
                  value={newApp.githubRepo}
                  onChange={(e) => props.onNewApp({ githubRepo: e.target.value })}
                />
                <input
                  className="field"
                  placeholder={t(locale, "apkUrlOptional")}
                  value={newApp.apkUrl}
                  onChange={(e) => props.onNewApp({ apkUrl: e.target.value })}
                />
                <button type="button" disabled={busy} onClick={() => props.onAddCatalogApp()}>
                  {t(locale, "saveCatalog")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="section-gap">
        <button
          type="button"
          className="disclosure"
          onClick={() => props.onVpnOpen(!vpnOpen)}
        >
          <span>{t(locale, "vpnSection")}</span>
          <span className="chevron">{vpnOpen ? "▾" : "◂"}</span>
        </button>
        {vpnOpen ? (
          <div className="vpn-body">
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
              disabled={
                busy ||
                !vpnForm.days.trim() ||
                !vpnForm.gigabytes.trim()
              }
              onClick={() => props.onProvisionVpn()}
            >
              {t(locale, "vpnProvision")}
            </button>
            {vpnResult ? (
              <div className="vpn-result">
                {vpnResult.username ? (
                  <p className="muted">
                    {t(locale, "vpnAssignedUser")}: {vpnResult.username}
                  </p>
                ) : null}
                <p className="muted">
                  {t(locale, "vpnStatus")}: {vpnResult.status ?? "—"}
                  {vpnResult.action ? ` (${vpnResult.action})` : ""}
                </p>
                {vpnResult.message ? (
                  <p className="muted tiny">{vpnResult.message}</p>
                ) : null}
                {vpnResult.subscriptionUrl ? (
                  <>
                    <p className="muted tiny">{vpnResult.subscriptionUrl}</p>
                    <div className="actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => props.onCopyVpnLink()}
                      >
                        {t(locale, "vpnCopyLink")}
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy || !vpnResult.username}
                        onClick={() => props.onDeleteVpn()}
                      >
                        {t(locale, "vpnDelete")}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy || !vpnResult.username}
                    onClick={() => props.onDeleteVpn()}
                  >
                    {t(locale, "vpnDelete")}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="section-gap">
        <button
          type="button"
          className="disclosure"
          onClick={() => props.onManualOpen(!manualOpen)}
        >
          <span>{t(locale, "manualInstall")}</span>
          <span className="chevron">{manualOpen ? "▾" : "◂"}</span>
        </button>
        {manualOpen ? (
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
        ) : null}
      </div>

      <div className="section-gap">
        <h2>{t(locale, "backupPhone")}</h2>
        <p className="muted">{t(locale, "backupHint")}</p>
        <button type="button" disabled={busy} onClick={() => props.onStartBackup()}>
          {t(locale, "startBackup")}
        </button>

        {backupJob ? (
          <div className="backup-box">
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${Math.max(4, backupJob.percent)}%` }}
              />
            </div>
            <p className="muted">
              {backupJob.message}
              {backupJob.currentTarget ? ` — ${backupJob.currentTarget}` : ""}
              {` (${backupJob.percent}%)`}
            </p>
            <div className="actions">
              {backupJob.phase === "paused" ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => props.onBackupAction("resume")}
                >
                  {t(locale, "resume")}
                </button>
              ) : (
                <button
                  type="button"
                  className="secondary"
                  disabled={["done", "cancelled", "error", "cancelling"].includes(
                    backupJob.phase,
                  )}
                  onClick={() => props.onBackupAction("pause")}
                >
                  {t(locale, "pause")}
                </button>
              )}
              <button
                type="button"
                className="secondary"
                disabled={["done", "cancelled", "error"].includes(backupJob.phase)}
                onClick={() => props.onBackupAction("cancel")}
              >
                {t(locale, "cancel")}
              </button>
            </div>
            {backupJob.phase === "done" && backupJob.folder ? (
              <p className="muted tiny">{backupJob.folder}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? <p className="error">{error}</p> : null}
    </aside>
  );
}
