import { useEffect, useMemo, useRef, useState } from "react";
import {
  MANUAL_SOURCE_IDS,
  dirFor,
  sourceLabel,
  t,
  type Locale,
  type Theme,
} from "./i18n";

type Role = "user" | "assistant";
type Msg = { role: Role; content: string };
type Device = { serial: string; status: string };
type NetworkStatus = {
  wifiEnabled: boolean | null;
  mobileDataEnabled: boolean | null;
  airplaneMode: boolean | null;
  wifiConnected: boolean | null;
  wifiSsid?: string | null;
};
type PendingAction = { tool: string; label: string };

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

type ManualSource = (typeof MANUAL_SOURCE_IDS)[number];

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

function applyDocumentChrome(theme: Theme, locale: Locale) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("lang", locale);
  root.setAttribute("dir", dirFor(locale));
}

export function App() {
  const [theme, setTheme] = useState<Theme>("night");
  const [locale, setLocale] = useState<Locale>("fa");
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceSerial, setDeviceSerial] = useState("");
  const [network, setNetwork] = useState<NetworkStatus | null>(null);
  const [health, setHealth] = useState<{
    hasOpenAIKey: boolean;
    model: string;
    shopWifiSsid?: string;
    hasShopWifiPassword?: boolean;
  } | null>(null);
  const [shopSsid, setShopSsid] = useState("nibero");
  const [shopPassword, setShopPassword] = useState("");
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [appMsg, setAppMsg] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogApp[]>([]);
  const [appsOpen, setAppsOpen] = useState(true);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [showAddApp, setShowAddApp] = useState(false);
  const [newApp, setNewApp] = useState({
    label: "",
    packageId: "",
    localApkPath: "",
    githubRepo: "",
    apkUrl: "",
  });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSource, setManualSource] = useState<ManualSource>("model_search");
  const [manualTargets, setManualTargets] = useState<CatalogApp[]>([]);
  const [backupJob, setBackupJob] = useState<BackupJob | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [welcomeSet, setWelcomeSet] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const selectedSerial = useMemo(
    () => deviceSerial || devices.find((d) => d.status === "device")?.serial || "",
    [deviceSerial, devices],
  );

  const phoneConnected = useMemo(
    () => devices.some((d) => d.status === "device"),
    [devices],
  );

  const manualSourceOptions = useMemo(
    () => MANUAL_SOURCE_IDS.map((id) => ({ id, label: sourceLabel(locale, id) })),
    [locale],
  );

  useEffect(() => {
    applyDocumentChrome(theme, locale);
  }, [theme, locale]);

  useEffect(() => {
    if (!welcomeSet) {
      setMessages([{ role: "assistant", content: t(locale, "welcome") }]);
      setWelcomeSet(true);
      return;
    }
    setMessages((prev) => {
      if (prev.length === 1 && prev[0]?.role === "assistant") {
        return [{ role: "assistant", content: t(locale, "welcome") }];
      }
      return prev;
    });
  }, [locale, welcomeSet]);

  async function loadCatalog() {
    try {
      const res = await fetch("/api/apps/catalog").then((r) => r.json());
      if (res.ok) setCatalog(res.apps ?? []);
    } catch {
      /* ignore */
    }
  }

  async function refresh() {
    setError(null);
    try {
      const [h, d, s] = await Promise.all([
        fetch("/api/health").then((r) => r.json()),
        fetch("/api/devices").then((r) => r.json()),
        fetch("/api/settings").then((r) => r.json()),
      ]);
      setHealth(h);
      if (s.ok && s.settings) {
        if (s.settings.shopWifiSsid) setShopSsid(s.settings.shopWifiSsid);
        if (s.settings.theme === "day" || s.settings.theme === "night") {
          setTheme(s.settings.theme);
        }
        if (s.settings.locale === "fa" || s.settings.locale === "en") {
          setLocale(s.settings.locale);
        }
      }
      if (d.ok) setDevices(d.devices ?? []);
      else setError(d.message ?? t(locale, "devicesError"));

      const serial =
        deviceSerial ||
        (d.ok ? d.devices?.find((x: Device) => x.status === "device")?.serial : "");
      if (serial) {
        const n = await fetch(
          `/api/network?deviceSerial=${encodeURIComponent(serial)}`,
        ).then((r) => r.json());
        if (n.ok) setNetwork(n.status);
        else setNetwork(null);
      } else setNetwork(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void refresh();
    void loadCatalog();
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!backupJob?.jobId) return;
    if (["done", "cancelled", "error"].includes(backupJob.phase)) return;
    const id = setInterval(() => {
      void fetch(`/api/backup/${encodeURIComponent(backupJob.jobId)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.job) setBackupJob(data.job);
        })
        .catch(() => undefined);
    }, 1000);
    return () => clearInterval(id);
  }, [backupJob?.jobId, backupJob?.phase]);

  async function persistPrefs(patch: { theme?: Theme; locale?: Locale }) {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      /* ignore */
    }
  }

  async function changeTheme(next: Theme) {
    setTheme(next);
    applyDocumentChrome(next, locale);
    await persistPrefs({ theme: next });
  }

  async function changeLocale(next: Locale) {
    setLocale(next);
    applyDocumentChrome(theme, next);
    await persistPrefs({ locale: next });
  }

  async function saveShopSettings() {
    setSettingsMsg(null);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopWifiSsid: shopSsid,
        ...(shopPassword ? { shopWifiPassword: shopPassword } : {}),
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      setSettingsMsg(data.message ?? "Error");
      return;
    }
    setShopPassword("");
    setSettingsMsg(t(locale, "saved"));
    await refresh();
  }

  async function shopWifi(action: "connect" | "forget") {
    setBusy(true);
    setActionMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/network/shop-wifi/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceSerial: selectedSerial || undefined }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.message ?? "Failed");
      else {
        setActionMsg(data.message ?? "OK");
        if (data.after) setNetwork(data.after);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function toggleAppSelect(packageId: string) {
    setSelectedApps((prev) =>
      prev.includes(packageId) ? prev.filter((p) => p !== packageId) : [...prev, packageId],
    );
  }

  /** One-click Google Play only — no source dialogs */
  async function installFromPlayDirect(apps: CatalogApp[]) {
    if (!apps.length) return;
    setBusy(true);
    setAppMsg(t(locale, "installing"));
    setError(null);
    const notes: string[] = [];
    const failed: CatalogApp[] = [];
    try {
      for (const app of apps) {
        const res = await fetch("/api/apps/install", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageId: app.packageId,
            appLabel: app.label,
            source: "play",
            playReady: true,
            fallback: false,
            deviceSerial: selectedSerial || undefined,
          }),
        });
        const data = await res.json();
        if (data.installed) {
          notes.push(`${app.label}: ${t(locale, "installedOk")}`);
        } else {
          failed.push(app);
          notes.push(`${app.label}: ${t(locale, "playFail")}`);
        }
      }
      setAppMsg(notes.join(" · "));
      if (failed.length) {
        setManualTargets(failed);
        setManualOpen(true);
      }
      setSelectedApps([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setManualTargets(apps);
      setManualOpen(true);
      setAppMsg(t(locale, "playFail"));
    } finally {
      setBusy(false);
    }
  }

  async function runManualInstall() {
    const apps =
      manualTargets.length > 0
        ? manualTargets
        : catalog.filter((a) => selectedApps.includes(a.packageId));
    if (!apps.length) {
      setError(t(locale, "needLabelPackage"));
      return;
    }
    setBusy(true);
    setAppMsg(t(locale, "installing"));
    setError(null);
    const notes: string[] = [];
    try {
      for (const app of apps) {
        let mapped: ManualSource | "url" = manualSource;
        if (manualSource === "github" && !app.sources.githubRepo && app.sources.apkUrl) {
          mapped = "url";
        }
        const res = await fetch("/api/apps/install", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageId: app.packageId,
            appLabel: app.label,
            source: mapped,
            playReady: false,
            fallback: false,
            deviceSerial: selectedSerial || undefined,
          }),
        });
        const data = await res.json();
        if (data.browserOpened && !data.installed) {
          notes.push(`${app.label}: ${t(locale, "searchOpened")}`);
        } else if (data.installed) {
          notes.push(`${app.label}: ${t(locale, "installedOk")}`);
        } else {
          notes.push(`${app.label}: ${data.message ?? "Failed"}`);
        }
      }
      setAppMsg(notes.join(" · "));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function addCatalogApp() {
    if (!newApp.label.trim() || !newApp.packageId.trim()) {
      setError(t(locale, "needLabelPackage"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/apps/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newApp.label.trim(),
          packageId: newApp.packageId.trim(),
          localApkPath: newApp.localApkPath.trim() || undefined,
          githubRepo: newApp.githubRepo.trim() || undefined,
          apkUrl: newApp.apkUrl.trim() || undefined,
          play: true,
        }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.message ?? "Failed");
      else {
        setAppMsg(data.message ?? t(locale, "saved"));
        setNewApp({ label: "", packageId: "", localApkPath: "", githubRepo: "", apkUrl: "" });
        setShowAddApp(false);
        await loadCatalog();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function startBackup() {
    setBusy(true);
    setAppMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceSerial: selectedSerial || undefined }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.message ?? "Failed");
      else {
        setBackupJob(data.job);
        setAppMsg(t(locale, "backupStarted"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function backupAction(action: "pause" | "resume" | "cancel") {
    if (!backupJob?.jobId) return;
    const res = await fetch(
      `/api/backup/${encodeURIComponent(backupJob.jobId)}/${action}`,
      { method: "POST" },
    );
    const data = await res.json();
    if (data.ok && data.job) setBackupJob(data.job);
  }

  async function toggleWifi(enabled: boolean) {
    setBusy(true);
    setError(null);
    setActionMsg(null);
    try {
      const res = await fetch("/api/network/wifi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          deviceSerial: selectedSerial || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.message ?? "Error");
      else {
        if (data.status) setNetwork(data.status);
        setActionMsg(data.message ?? (enabled ? "Wi‑Fi ON" : "Wi‑Fi OFF"));
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function send(confirmAction = false) {
    const text = (inputRef.current?.value ?? input).trim();
    if (!confirmAction && !text) return;
    setBusy(true);
    setError(null);

    const nextMessages = confirmAction
      ? messages
      : [...messages, { role: "user" as const, content: text }];

    if (!confirmAction) {
      setMessages(nextMessages);
      setInput("");
      if (inputRef.current) inputRef.current.value = "";
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          deviceSerial: selectedSerial || undefined,
          confirmAction,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? "Chat error");
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? "" }]);
      setPendingAction(data.pendingAction ?? null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const pinned = catalog.filter((a) => a.pinned !== false).slice(0, 4);

  return (
    <div className="app">
      <div className="atmosphere" aria-hidden="true" />
      <header className="brand">
        <div className="brand-top">
          <div className="brand-title-block">
            <p className="brand-kicker">Android repair desk</p>
            <h1>Fixo</h1>
          </div>
          <div className="toolbar">
            <span
              className={
                phoneConnected
                  ? "connect-badge on pulse"
                  : "connect-badge off"
              }
            >
              <span className="connect-dot" />
              {phoneConnected ? t(locale, "connected") : t(locale, "disconnected")}
            </span>
            <div className="toggle-group" role="group" aria-label="theme">
              <button
                type="button"
                className={theme === "night" ? "active" : "secondary"}
                onClick={() => void changeTheme("night")}
              >
                {t(locale, "themeNight")}
              </button>
              <button
                type="button"
                className={theme === "day" ? "active" : "secondary"}
                onClick={() => void changeTheme("day")}
              >
                {t(locale, "themeDay")}
              </button>
            </div>
            <div className="toggle-group" role="group" aria-label="language">
              <button
                type="button"
                className={locale === "fa" ? "active" : "secondary"}
                onClick={() => void changeLocale("fa")}
              >
                {t(locale, "langFa")}
              </button>
              <button
                type="button"
                className={locale === "en" ? "active" : "secondary"}
                onClick={() => void changeLocale("en")}
              >
                {t(locale, "langEn")}
              </button>
            </div>
          </div>
        </div>
        <p className="brand-tagline">{t(locale, "tagline")}</p>
      </header>

      <div className="layout">
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
              onChange={(e) => setDeviceSerial(e.target.value)}
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
            <button type="button" disabled={busy} onClick={() => void toggleWifi(true)}>
              {t(locale, "onPlus")} {health?.shopWifiSsid || "nibero"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void toggleWifi(false)}
            >
              {t(locale, "off")}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void shopWifi("forget")}
            >
              {t(locale, "forgetShop")}
            </button>
          </div>
          {actionMsg ? <p className="muted">{actionMsg}</p> : null}

          <div className="section-gap">
            <button
              type="button"
              className="disclosure"
              onClick={() => setAppsOpen((v) => !v)}
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
                      onClick={() => void installFromPlayDirect([app])}
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
                        onChange={() => toggleAppSelect(app.packageId)}
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
                      void installFromPlayDirect(
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
                    onClick={() => setShowAddApp((v) => !v)}
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
                      onChange={(e) => setNewApp((s) => ({ ...s, label: e.target.value }))}
                    />
                    <input
                      className="field"
                      placeholder={t(locale, "packageId")}
                      value={newApp.packageId}
                      onChange={(e) =>
                        setNewApp((s) => ({ ...s, packageId: e.target.value }))
                      }
                    />
                    <input
                      className="field"
                      placeholder={t(locale, "localApkOptional")}
                      value={newApp.localApkPath}
                      onChange={(e) =>
                        setNewApp((s) => ({ ...s, localApkPath: e.target.value }))
                      }
                    />
                    <input
                      className="field"
                      placeholder={t(locale, "githubOptional")}
                      value={newApp.githubRepo}
                      onChange={(e) =>
                        setNewApp((s) => ({ ...s, githubRepo: e.target.value }))
                      }
                    />
                    <input
                      className="field"
                      placeholder={t(locale, "apkUrlOptional")}
                      value={newApp.apkUrl}
                      onChange={(e) => setNewApp((s) => ({ ...s, apkUrl: e.target.value }))}
                    />
                    <button type="button" disabled={busy} onClick={() => void addCatalogApp()}>
                      {t(locale, "saveCatalog")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {appMsg ? <p className="muted app-msg">{appMsg}</p> : null}

          <div className="section-gap">
            <button
              type="button"
              className="disclosure"
              onClick={() => setManualOpen((v) => !v)}
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
                      className={
                        manualSource === opt.id ? "source-btn active" : "source-btn"
                      }
                      onClick={() => setManualSource(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runManualInstall()}
                  >
                    {t(locale, "runManual")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="section-gap">
            <h2>{t(locale, "backupPhone")}</h2>
            <p className="muted">{t(locale, "backupHint")}</p>
            <button type="button" disabled={busy} onClick={() => void startBackup()}>
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
                      onClick={() => void backupAction("resume")}
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
                      onClick={() => void backupAction("pause")}
                    >
                      {t(locale, "pause")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    disabled={["done", "cancelled", "error"].includes(backupJob.phase)}
                    onClick={() => void backupAction("cancel")}
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

          <button
            type="button"
            className="secondary"
            style={{ width: "100%", marginTop: 14 }}
            onClick={() => setShowSettings((v) => !v)}
          >
            {showSettings ? t(locale, "closeSettings") : t(locale, "settingsWifi")}
          </button>

          {showSettings ? (
            <div className="settings-box">
              <input
                className="field"
                value={shopSsid}
                onChange={(e) => setShopSsid(e.target.value)}
                placeholder={t(locale, "ssid")}
              />
              <input
                className="field"
                type="password"
                value={shopPassword}
                onChange={(e) => setShopPassword(e.target.value)}
                placeholder={
                  health?.hasShopWifiPassword
                    ? t(locale, "passwordNew")
                    : t(locale, "passwordShop")
                }
              />
              <button type="button" disabled={busy} onClick={() => void saveShopSettings()}>
                {t(locale, "save")}
              </button>
              {settingsMsg ? <p className="muted">{settingsMsg}</p> : null}
            </div>
          ) : null}

          {error ? <p className="error">{error}</p> : null}
        </aside>

        <section className="panel chat panel-chat">
          <h2>{t(locale, "chat")}</h2>
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.content}
              </div>
            ))}
          </div>

          {pendingAction ? (
            <div className="confirm">
              <span>{pendingAction.label}</span>
              <div className="actions">
                <button type="button" disabled={busy} onClick={() => void send(true)}>
                  {t(locale, "confirm")}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setPendingAction(null)}
                >
                  {t(locale, "cancel")}
                </button>
              </div>
            </div>
          ) : null}

          <div className="composer">
            <textarea
              ref={inputRef}
              value={input}
              placeholder={t(locale, "chatPlaceholder")}
              onChange={(e) => setInput(e.target.value)}
              onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(false);
                }
              }}
            />
            <button type="button" disabled={busy} onClick={() => void send(false)}>
              {busy ? t(locale, "sending") : t(locale, "send")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
