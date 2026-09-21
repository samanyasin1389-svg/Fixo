import { useEffect, useMemo, useRef, useState } from "react";

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

type InstallSource = "auto" | "play" | "local_apk" | "github" | "url";

type BackupJob = {
  jobId: string;
  phase: string;
  percent: number;
  message: string;
  folder?: string;
  contactsCount?: number;
  currentTarget?: string;
};

const SOURCE_OPTIONS: Array<{ id: InstallSource; label: string }> = [
  { id: "auto", label: "خودکار (پیشنهادی)" },
  { id: "play", label: "گوگل پلی" },
  { id: "local_apk", label: "فایل APK روی لپ‌تاپ" },
  { id: "github", label: "گیت‌هاب / لینک مستقیم" },
];

function pillClass(v: boolean | null) {
  if (v === null) return "pill unknown";
  return v ? "pill on" : "pill off";
}

function pillLabel(v: boolean | null) {
  if (v === null) return "—";
  return v ? "ON" : "OFF";
}

export function App() {
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
  const [appsOpen, setAppsOpen] = useState(false);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [showAddApp, setShowAddApp] = useState(false);
  const [newApp, setNewApp] = useState({
    label: "",
    packageId: "",
    localApkPath: "",
    githubRepo: "",
    apkUrl: "",
  });
  const [installStep, setInstallStep] = useState<null | "playAsk" | "source">(null);
  const [pendingPackages, setPendingPackages] = useState<CatalogApp[]>([]);
  const [installSource, setInstallSource] = useState<InstallSource>("auto");
  const [backupJob, setBackupJob] = useState<BackupJob | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "سلام. وای‌فای مغازه، نصب برنامه، یا بک‌آپ گوشی را بگو.",
    },
  ]);
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
      if (s.ok && s.settings?.shopWifiSsid) setShopSsid(s.settings.shopWifiSsid);
      if (d.ok) setDevices(d.devices ?? []);
      else setError(d.message ?? "خطا در خواندن دستگاه‌ها");

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
      setSettingsMsg(data.message ?? "خطا در ذخیره");
      return;
    }
    setShopPassword("");
    setSettingsMsg("ذخیره شد.");
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
      if (!data.ok) setError(data.message ?? "ناموفق");
      else {
        setActionMsg(data.message ?? "انجام شد");
        if (data.after) setNetwork(data.after);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function beginInstall(apps: CatalogApp[]) {
    if (!apps.length) return;
    setPendingPackages(apps);
    setInstallSource("auto");
    setInstallStep("playAsk");
    setAppMsg(null);
    setError(null);
  }

  function toggleAppSelect(packageId: string) {
    setSelectedApps((prev) =>
      prev.includes(packageId) ? prev.filter((p) => p !== packageId) : [...prev, packageId],
    );
  }

  async function runInstallCascade(source: InstallSource) {
    setInstallStep(null);
    setBusy(true);
    setAppMsg(null);
    setError(null);
    const notes: string[] = [];
    try {
      for (const app of pendingPackages) {
        const mappedSource: InstallSource =
          source === "github" && !app.sources.githubRepo && app.sources.apkUrl
            ? "url"
            : source;
        const res = await fetch("/api/apps/install", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageId: app.packageId,
            source: mappedSource,
            fallback: true,
            deviceSerial: selectedSerial || undefined,
          }),
        });
        const data = await res.json();
        notes.push(
          data.ok
            ? `${app.label}: نصب شد (${data.usedSource ?? source})`
            : `${app.label}: ${data.message ?? "ناموفق"}`,
        );
      }
      setAppMsg(notes.join(" · "));
      setSelectedApps([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setPendingPackages([]);
    }
  }

  async function addCatalogApp() {
    if (!newApp.label.trim() || !newApp.packageId.trim()) {
      setError("نام و packageId لازم است");
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
      if (!data.ok) setError(data.message ?? "افزودن ناموفق");
      else {
        setAppMsg(data.message ?? "اضافه شد");
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
      if (!data.ok) setError(data.message ?? "بک‌آپ ناموفق");
      else {
        setBackupJob(data.job);
        setAppMsg("بک‌آپ شروع شد");
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
      if (!data.ok) setError(data.message ?? "خطا");
      else {
        if (data.status) setNetwork(data.status);
        setActionMsg(data.message ?? (enabled ? "Wi‑Fi روشن شد" : "Wi‑Fi خاموش شد"));
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
        setError(data.message ?? "خطای چت");
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
      <header className="brand">
        <h1>Fixo</h1>
        <p>وای‌فای مغازه، نصب برنامه، بک‌آپ گوشی</p>
      </header>

      <div className="layout">
        <aside className="panel">
          <h2>شبکه مغازه</h2>
          <div className="status-row">
            <span>ADB</span>
            <span className="pill unknown">{devices.length}</span>
          </div>
          <div className="status-row">
            <span>Wi‑Fi</span>
            <span className={pillClass(network?.wifiEnabled ?? null)}>
              {pillLabel(network?.wifiEnabled ?? null)}
            </span>
          </div>
          <div className="status-row">
            <span>شبکه</span>
            <span className="pill unknown">{network?.wifiSsid || "—"}</span>
          </div>

          {devices.length > 1 ? (
            <select
              value={selectedSerial}
              onChange={(e) => setDeviceSerial(e.target.value)}
              className="field"
            >
              <option value="">خودکار</option>
              {devices.map((d) => (
                <option key={d.serial} value={d.serial}>
                  {d.serial}
                </option>
              ))}
            </select>
          ) : null}

          <div className="actions">
            <button type="button" disabled={busy} onClick={() => void toggleWifi(true)}>
              روشن + {health?.shopWifiSsid || "nibero"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void toggleWifi(false)}
            >
              خاموش
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void shopWifi("forget")}
            >
              فراموش مغازه
            </button>
          </div>
          {actionMsg ? <p className="muted">{actionMsg}</p> : null}

          <div className="section-gap">
            <button
              type="button"
              className="disclosure"
              onClick={() => setAppsOpen((v) => !v)}
            >
              <span>برنامه‌ها ({catalog.length})</span>
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
                      disabled={busy || !!installStep}
                      onClick={() => beginInstall([app])}
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
                    disabled={busy || !selectedApps.length || !!installStep}
                    onClick={() =>
                      beginInstall(
                        catalog.filter((a) => selectedApps.includes(a.packageId)),
                      )
                    }
                  >
                    نصب انتخاب‌شده‌ها
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => setShowAddApp((v) => !v)}
                  >
                    {showAddApp ? "بستن فرم" : "افزودن برنامه"}
                  </button>
                </div>

                {showAddApp ? (
                  <div className="settings-box">
                    <input
                      className="field"
                      placeholder="نام نمایشی (مثلاً اسنپ)"
                      value={newApp.label}
                      onChange={(e) => setNewApp((s) => ({ ...s, label: e.target.value }))}
                    />
                    <input
                      className="field"
                      placeholder="packageId (مثلاً cab.snapp.passenger)"
                      value={newApp.packageId}
                      onChange={(e) =>
                        setNewApp((s) => ({ ...s, packageId: e.target.value }))
                      }
                    />
                    <input
                      className="field"
                      placeholder="مسیر APK محلی (اختیاری)"
                      value={newApp.localApkPath}
                      onChange={(e) =>
                        setNewApp((s) => ({ ...s, localApkPath: e.target.value }))
                      }
                    />
                    <input
                      className="field"
                      placeholder="گیت‌هاب owner/repo (اختیاری)"
                      value={newApp.githubRepo}
                      onChange={(e) =>
                        setNewApp((s) => ({ ...s, githubRepo: e.target.value }))
                      }
                    />
                    <input
                      className="field"
                      placeholder="لینک مستقیم APK (اختیاری)"
                      value={newApp.apkUrl}
                      onChange={(e) => setNewApp((s) => ({ ...s, apkUrl: e.target.value }))}
                    />
                    <button type="button" disabled={busy} onClick={() => void addCatalogApp()}>
                      ذخیره در کاتالوگ
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {installStep === "playAsk" ? (
            <div className="choice-box">
              <p>اکانت پلی روی گوشی آماده‌ست؟</p>
              <div className="actions">
                <button type="button" onClick={() => setInstallStep("source")}>
                  بله
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setInstallStep(null);
                    setPendingPackages([]);
                    setAppMsg("نصب لغو شد — اول اکانت پلی را آماده کنید.");
                  }}
                >
                  بعداً
                </button>
              </div>
            </div>
          ) : null}

          {installStep === "source" ? (
            <div className="choice-box">
              <p>از کجا نصب کنم؟</p>
              <div className="source-list">
                {SOURCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={
                      installSource === opt.id ? "source-btn active" : "source-btn"
                    }
                    onClick={() => setInstallSource(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runInstallCascade(installSource)}
                >
                  شروع نصب
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setInstallStep(null);
                    setPendingPackages([]);
                  }}
                >
                  لغو
                </button>
              </div>
            </div>
          ) : null}

          {appMsg ? <p className="muted">{appMsg}</p> : null}

          <div className="section-gap">
            <h2>بک‌آپ گوشی</h2>
            <p className="muted">عکس، فیلم و مخاطبین → Desktop/Fixo-Backups</p>
            <button type="button" disabled={busy} onClick={() => void startBackup()}>
              شروع بک‌آپ
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
                  {` (${backupJob.percent}٪)`}
                </p>
                <div className="actions">
                  {backupJob.phase === "paused" ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void backupAction("resume")}
                    >
                      ادامه
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
                      توقف موقت
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    disabled={["done", "cancelled", "error"].includes(backupJob.phase)}
                    onClick={() => void backupAction("cancel")}
                  >
                    لغو
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
            {showSettings ? "بستن تنظیمات" : "تنظیمات رمز وای‌فای"}
          </button>

          {showSettings ? (
            <div className="settings-box">
              <input
                className="field"
                value={shopSsid}
                onChange={(e) => setShopSsid(e.target.value)}
                placeholder="SSID"
              />
              <input
                className="field"
                type="password"
                value={shopPassword}
                onChange={(e) => setShopPassword(e.target.value)}
                placeholder={
                  health?.hasShopWifiPassword ? "رمز جدید (اختیاری)" : "رمز وای‌فای مغازه"
                }
              />
              <button type="button" disabled={busy} onClick={() => void saveShopSettings()}>
                ذخیره
              </button>
              {settingsMsg ? <p className="muted">{settingsMsg}</p> : null}
            </div>
          ) : null}

          {error ? <p className="error">{error}</p> : null}
        </aside>

        <section className="panel chat">
          <h2>گفتگو</h2>
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
                  تأیید
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setPendingAction(null)}
                >
                  لغو
                </button>
              </div>
            </div>
          ) : null}

          <div className="composer">
            <textarea
              ref={inputRef}
              value={input}
              placeholder="مثلاً: وای‌فای را روشن کن / تلگرام نصب کن"
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
              {busy ? "..." : "ارسال"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
