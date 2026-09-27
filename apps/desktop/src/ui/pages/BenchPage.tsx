import { Link } from "react-router-dom";
import type { Locale } from "../i18n";
import { t } from "../i18n";
import {
  IconApps,
  IconBackup,
  IconChevron,
  IconMail,
  IconNetwork,
  IconSettings,
  IconShield,
  IconWrench,
} from "../icons";

export type CatalogApp = {
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

type Device = { serial: string; status: string };
type NetworkStatus = {
  wifiEnabled: boolean | null;
  mobileDataEnabled: boolean | null;
  airplaneMode: boolean | null;
  wifiConnected: boolean | null;
  wifiSsid?: string | null;
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

function pillClass(v: boolean | null) {
  if (v === null) return "pill unknown";
  return v ? "pill on" : "pill off";
}

function pillLabel(v: boolean | null) {
  if (v === null) return "—";
  return v ? "ON" : "OFF";
}

function backupActive(job: BackupJob | null) {
  if (!job) return false;
  return !["done", "cancelled", "error", "cancelling"].includes(job.phase);
}

export type BenchPageProps = {
  locale: Locale;
  devices: Device[];
  selectedSerial: string;
  network: NetworkStatus | null;
  shopWifiSsid: string;
  catalog: CatalogApp[];
  showAddApp: boolean;
  newApp: {
    label: string;
    packageId: string;
    localApkPath: string;
    githubRepo: string;
    apkUrl: string;
  };
  backupJob: BackupJob | null;
  showInstallNetworkPrompt: boolean;
  busy: boolean;
  actionMsg: string | null;
  error: string | null;
  onDeviceSerial: (v: string) => void;
  onToggleWifi: (enabled: boolean) => void;
  onShopWifiForget: () => void;
  onInstallPlay: (apps: CatalogApp[]) => void;
  onShowAddApp: (v: boolean) => void;
  onNewApp: (patch: Partial<BenchPageProps["newApp"]>) => void;
  onAddCatalogApp: () => void;
  onStartBackup: () => void;
  onBackupAction: (action: "pause" | "resume" | "cancel") => void;
  onEnableWifiForInstall: () => void;
  onEnableMobileForInstall: () => void;
  onDismissInstallNetworkPrompt: () => void;
};

export function BenchPage(props: BenchPageProps) {
  const {
    locale,
    devices,
    selectedSerial,
    network,
    shopWifiSsid,
    catalog,
    showAddApp,
    newApp,
    backupJob,
    showInstallNetworkPrompt,
    busy,
    actionMsg,
    error,
  } = props;

  const pinned = catalog.filter((a) => a.pinned !== false).slice(0, 4);
  const backupRunning = backupActive(backupJob);

  const tools = [
    { to: "/vpn", label: t(locale, "vpnSection"), Icon: IconShield },
    { to: "/gmail", label: t(locale, "gmailSection"), Icon: IconMail },
    {
      to: "/phone-settings",
      label: t(locale, "phoneSettingsSection"),
      Icon: IconSettings,
    },
    { to: "/manual", label: t(locale, "manualInstall"), Icon: IconWrench },
  ] as const;

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
          <span>{t(locale, "mobileData")}</span>
          <span className={pillClass(network?.mobileDataEnabled ?? null)}>
            {pillLabel(network?.mobileDataEnabled ?? null)}
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
        <button
          type="button"
          disabled={busy}
          onClick={() => props.onToggleWifi(!(network?.wifiEnabled ?? false))}
        >
          {(network?.wifiEnabled ?? false)
            ? t(locale, "wifiOff")
            : t(locale, "wifiOn")}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => props.onShopWifiForget()}
        >
          {t(locale, "forgetWifi")} {shopWifiSsid}
        </button>
      </div>

      {actionMsg ? <p className="muted">{actionMsg}</p> : null}

      {showInstallNetworkPrompt ? (
        <div className="install-net-prompt" role="dialog" aria-live="polite">
          <p className="muted">{t(locale, "installNeedNetwork")}</p>
          <div className="actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => props.onEnableWifiForInstall()}
            >
              {t(locale, "installEnableWifi")}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => props.onEnableMobileForInstall()}
            >
              {t(locale, "installEnableMobile")}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => props.onDismissInstallNetworkPrompt()}
            >
              {t(locale, "cancel")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="section-gap">
        <div className="disclosure static">
          <span className="disclosure-with-icon">
            <IconApps size={18} />
            <span>
              {t(locale, "apps")} ({catalog.length})
            </span>
          </span>
        </div>
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
          <div className="actions">
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
      </div>

      <div className="section-gap">
        <div className="disclosure static">
          <span className="disclosure-with-icon">
            <IconNetwork size={18} />
            <span>{t(locale, "benchTools")}</span>
          </span>
        </div>
        <div className="bench-tool-list">
          {tools.map(({ to, label, Icon }) => (
            <Link key={to} to={to} className="bench-tool-link">
              <span className="bench-tool-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span>{label}</span>
              <span className="bench-tool-chevron" aria-hidden="true">
                <IconChevron size={16} direction={locale === "fa" ? "start" : "end"} />
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="section-gap">
        <p className="muted">{t(locale, "backupHint")}</p>
        {!backupRunning ? (
          <button
            type="button"
            className="backup-start-btn"
            disabled={busy}
            onClick={() => props.onStartBackup()}
          >
            <IconBackup size={20} />
            <span>{t(locale, "startBackup")}</span>
          </button>
        ) : null}

        {backupJob && backupRunning ? (
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
                  onClick={() => props.onBackupAction("pause")}
                >
                  {t(locale, "pause")}
                </button>
              )}
              <button
                type="button"
                className="secondary danger-btn"
                onClick={() => props.onBackupAction("cancel")}
              >
                {t(locale, "cancel")}
              </button>
            </div>
          </div>
        ) : null}

        {backupJob && !backupRunning && backupJob.phase === "done" && backupJob.folder ? (
          <p className="muted tiny">{backupJob.folder}</p>
        ) : null}
      </div>

      {error ? <p className="error">{error}</p> : null}
    </aside>
  );
}
