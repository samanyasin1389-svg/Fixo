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

const QUICK_APPS = [
  { label: "واتساپ", packageId: "com.whatsapp" },
  { label: "اینستا", packageId: "com.instagram.android" },
  { label: "تلگرام", packageId: "org.telegram.messenger" },
  { label: "وی‌توباکس", packageId: "dev.hexasoftware.v2box" },
] as const;

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
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "سلام. وای‌فای مغازه یا نصب واتساپ/اینستا/تلگرام/وی‌توباکس را بگو.",
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
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function installPlayApp(packageId: string, label: string) {
    setBusy(true);
    setAppMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/apps/install-play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId,
          deviceSerial: selectedSerial || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.message ?? `نصب ${label} ناموفق`);
      else setAppMsg(data.message ?? `${label} نصب شد`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
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

  return (
    <div className="app">
      <header className="brand">
        <h1>Fixo</h1>
        <p>وای‌فای مغازه و نصب اپ از Play</p>
      </header>

      <div className="layout">
        <aside className="panel">
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

          <h2>نصب سریع</h2>
          <div className="app-grid">
            {QUICK_APPS.map((app) => (
              <button
                key={app.packageId}
                type="button"
                className="app-btn"
                disabled={busy}
                onClick={() => void installPlayApp(app.packageId, app.label)}
              >
                {app.label}
              </button>
            ))}
          </div>
          {appMsg ? <p className="muted">{appMsg}</p> : null}

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
          <h2>Agent</h2>
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
