import { useEffect, useMemo, useRef, useState } from "react";
import {
  MANUAL_SOURCE_IDS,
  TAB_ORDER,
  dirFor,
  sourceLabel,
  t,
  type AppTab,
  type Locale,
  type Theme,
} from "./i18n";
import { ToastHost, useToastQueue } from "./Toast";
import { AuroraBackground } from "./AuroraBackground";
import { NavPill } from "./NavPill";
import { HomePage } from "./pages/HomePage";
import { AgentPage } from "./pages/AgentPage";
import { BenchPage } from "./pages/BenchPage";
import { SettingsPage } from "./pages/SettingsPage";

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

function applyDocumentChrome(theme: Theme, locale: Locale) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("lang", locale);
  root.setAttribute("dir", dirFor(locale));
}

export function App() {
  const [theme, setTheme] = useState<Theme>("galaxy");
  const [locale, setLocale] = useState<Locale>("fa");
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [slideDir, setSlideDir] = useState<"next" | "prev">("next");
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
  const { toasts, pushToast, dismissToast } = useToastQueue();
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
  const [vpnOpen, setVpnOpen] = useState(false);
  const [vpnForm, setVpnForm] = useState({ days: "", gigabytes: "" });
  const [vpnResult, setVpnResult] = useState<{
    username?: string;
    status?: string;
    action?: string;
    subscriptionUrl?: string;
    message?: string;
  } | null>(null);
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

  const dir = dirFor(locale);

  function goTab(next: AppTab) {
    const from = TAB_ORDER.indexOf(activeTab);
    const to = TAB_ORDER.indexOf(next);
    if (from === to) return;
    setSlideDir(to > from ? "next" : "prev");
    setActiveTab(next);
  }

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
        if (
          s.settings.theme === "galaxy" ||
          s.settings.theme === "emerald" ||
          s.settings.theme === "ice"
        ) {
          setTheme(s.settings.theme);
        }
        if (s.settings.locale === "fa" || s.settings.locale === "en") {
          setLocale(s.settings.locale);
        }
      }
      if (d.ok) setDevices(d.devices ?? []);
      else {
        setError(d.message ?? t(locale, "devicesError"));
      }

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
      if (!data.ok) {
        const msg = data.message ?? "Failed";
        setError(msg);
        pushToast(msg, "error");
      } else {
        const msg = data.message ?? "OK";
        setActionMsg(msg);
        pushToast(msg, "success");
        if (data.after) setNetwork(data.after);
      }
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      pushToast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  function toggleAppSelect(packageId: string) {
    setSelectedApps((prev) =>
      prev.includes(packageId) ? prev.filter((p) => p !== packageId) : [...prev, packageId],
    );
  }

  async function installFromPlayDirect(apps: CatalogApp[]) {
    if (!apps.length) return;
    setBusy(true);
    pushToast(t(locale, "installing"), "info");
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
      pushToast(notes.join(" · "), "info");
      if (failed.length) {
        setManualTargets(failed);
        setManualOpen(true);
      }
      setSelectedApps([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setManualTargets(apps);
      setManualOpen(true);
      pushToast(t(locale, "playFail"), "error");
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
    pushToast(t(locale, "installing"), "info");
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
      pushToast(notes.join(" · "), "info");
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
        pushToast(data.message ?? t(locale, "saved"), "success");
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
        pushToast(t(locale, "backupStarted"), "success");
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
      if (!data.ok) {
        const msg = data.message ?? "Error";
        setError(msg);
        pushToast(msg, "error");
      } else {
        if (data.status) setNetwork(data.status);
        const msg = data.message ?? (enabled ? "Wi‑Fi ON" : "Wi‑Fi OFF");
        setActionMsg(msg);
        pushToast(msg, "success");
      }
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      pushToast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  async function provisionVpn() {
    const days = Number(vpnForm.days);
    const gigabytes = Number(vpnForm.gigabytes);
    if (!Number.isFinite(days) || days <= 0 || !Number.isFinite(gigabytes) || gigabytes <= 0) {
      pushToast(t(locale, "vpnNeedFields"), "error");
      return;
    }
    setBusy(true);
    setError(null);
    setVpnResult(null);
    pushToast(t(locale, "vpnBusy"), "info");
    try {
      const res = await fetch("/api/vpn/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days,
          gigabytes,
          deviceSerial: selectedSerial || undefined,
          pushToDevice: true,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        const msg = data.message ?? "Failed";
        setError(msg);
        pushToast(msg, "error");
        return;
      }
      setVpnResult({
        username: data.account?.username,
        status: data.account?.status,
        action: data.account?.action,
        subscriptionUrl: data.account?.subscriptionUrl,
        message: data.message,
      });
      pushToast(data.message ?? data.account?.message ?? "OK", data.push?.ok === false ? "error" : "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      pushToast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  async function copyVpnLink() {
    const url = vpnResult?.subscriptionUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      pushToast(t(locale, "vpnLinkCopied"), "success");
    } catch {
      pushToast(url, "info");
    }
  }

  async function deleteVpnAccount() {
    const target = (vpnResult?.username ?? "").trim();
    if (!target) {
      pushToast(t(locale, "vpnNeedDeleteUser"), "error");
      return;
    }
    if (!window.confirm(t(locale, "vpnDeleteConfirm"))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/vpn/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: target }),
      });
      const data = await res.json();
      if (!data.ok) {
        pushToast(data.message ?? "Failed", "error");
        return;
      }
      setVpnResult(null);
      pushToast(data.message ?? t(locale, "vpnDeleted"), "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function send(
    confirmAction = false,
    opts?: { fromVoice?: boolean; text?: string },
  ) {
    const text = (opts?.text ?? inputRef.current?.value ?? input).trim();
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
        const msg = data.message ?? "Chat error";
        setError(msg);
        pushToast(msg, "error");
        return;
      }

      const assistantReply = data.reply ?? "";
      const withAssistant = [
        ...nextMessages,
        { role: "assistant" as const, content: assistantReply },
      ];
      setMessages(withAssistant);

      if (opts?.fromVoice && data.pendingAction) {
        pushToast(data.pendingAction.label, "info");
        const res2 = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: withAssistant,
            deviceSerial: selectedSerial || undefined,
            confirmAction: true,
          }),
        });
        const data2 = await res2.json();
        if (!data2.ok) {
          const msg = data2.message ?? "Chat error";
          setError(msg);
          pushToast(msg, "error");
          setPendingAction(data.pendingAction ?? null);
          return;
        }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data2.reply ?? "" },
        ]);
        setPendingAction(data2.pendingAction ?? null);
      } else {
        setPendingAction(data.pendingAction ?? null);
      }
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      pushToast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  function sendVoice(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    void send(false, { fromVoice: true, text: trimmed });
  }

  function onVoiceError(code: string) {
    if (code === "unsupported") {
      pushToast(t(locale, "voiceUnsupported"), "error");
      return;
    }
    if (code === "not-allowed") {
      pushToast(t(locale, "voiceDenied"), "error");
      return;
    }
    pushToast(t(locale, "voiceError"), "error");
  }

  const navLabels = {
    home: t(locale, "navHome"),
    agent: t(locale, "navAgent"),
    bench: t(locale, "navBench"),
    settings: t(locale, "navSettings"),
  };

  return (
    <div className="app">
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
      {theme === "galaxy" ? <AuroraBackground /> : null}
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
                phoneConnected ? "connect-badge on pulse" : "connect-badge off"
              }
            >
              <span className="connect-dot" />
              {phoneConnected ? t(locale, "connected") : t(locale, "disconnected")}
            </span>
          </div>
        </div>
        <p className="brand-tagline">{t(locale, "tagline")}</p>
      </header>

      <div className="tab-stage" key={activeTab}>
        <div className={`tab-panel dir-${slideDir}`}>
          {activeTab === "home" ? (
            <HomePage
              locale={locale}
              phoneConnected={phoneConnected}
              deviceCount={devices.length}
              wifiSsid={network?.wifiSsid}
              shopSsid={health?.shopWifiSsid || shopSsid}
              onGo={goTab}
            />
          ) : null}

          {activeTab === "agent" ? (
            <AgentPage
              locale={locale}
              messages={messages}
              pendingAction={pendingAction}
              input={input}
              inputRef={inputRef}
              busy={busy}
              onInput={setInput}
              onSend={(confirm) => void send(confirm)}
              onVoiceSend={sendVoice}
              onCancelPending={() => setPendingAction(null)}
              onVoiceError={onVoiceError}
            />
          ) : null}

          {activeTab === "bench" ? (
            <BenchPage
              locale={locale}
              devices={devices}
              selectedSerial={selectedSerial}
              network={network}
              shopWifiSsid={health?.shopWifiSsid || shopSsid}
              catalog={catalog}
              appsOpen={appsOpen}
              selectedApps={selectedApps}
              showAddApp={showAddApp}
              newApp={newApp}
              manualOpen={manualOpen}
              manualSource={manualSource}
              manualTargets={manualTargets}
              manualSourceOptions={manualSourceOptions}
              vpnOpen={vpnOpen}
              vpnForm={vpnForm}
              vpnResult={vpnResult}
              backupJob={backupJob}
              busy={busy}
              actionMsg={actionMsg}
              error={error}
              onDeviceSerial={setDeviceSerial}
              onToggleWifi={(enabled) => void toggleWifi(enabled)}
              onShopWifiForget={() => void shopWifi("forget")}
              onAppsOpen={setAppsOpen}
              onToggleAppSelect={toggleAppSelect}
              onInstallPlay={(apps) => void installFromPlayDirect(apps)}
              onShowAddApp={setShowAddApp}
              onNewApp={(patch) => setNewApp((s) => ({ ...s, ...patch }))}
              onAddCatalogApp={() => void addCatalogApp()}
              onVpnOpen={setVpnOpen}
              onVpnForm={(patch) => setVpnForm((s) => ({ ...s, ...patch }))}
              onProvisionVpn={() => void provisionVpn()}
              onCopyVpnLink={() => void copyVpnLink()}
              onDeleteVpn={() => void deleteVpnAccount()}
              onManualOpen={setManualOpen}
              onManualSource={setManualSource}
              onRunManual={() => void runManualInstall()}
              onStartBackup={() => void startBackup()}
              onBackupAction={(action) => void backupAction(action)}
            />
          ) : null}

          {activeTab === "settings" ? (
            <SettingsPage
              locale={locale}
              theme={theme}
              shopSsid={shopSsid}
              shopPassword={shopPassword}
              hasShopWifiPassword={Boolean(health?.hasShopWifiPassword)}
              settingsMsg={settingsMsg}
              busy={busy}
              onTheme={(next) => void changeTheme(next)}
              onLocale={(next) => void changeLocale(next)}
              onShopSsid={setShopSsid}
              onShopPassword={setShopPassword}
              onSave={() => void saveShopSettings()}
            />
          ) : null}
        </div>
      </div>

      <NavPill active={activeTab} onChange={goTab} labels={navLabels} dir={dir} />
    </div>
  );
}
