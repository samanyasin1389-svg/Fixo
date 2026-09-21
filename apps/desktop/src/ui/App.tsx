import { useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";
type Msg = { role: Role; content: string };

type Device = { serial: string; status: string };
type NetworkStatus = {
  wifiEnabled: boolean | null;
  mobileDataEnabled: boolean | null;
  airplaneMode: boolean | null;
  wifiConnected: boolean | null;
};
type PendingAction = {
  tool: string;
  enabled: boolean;
  deviceSerial?: string;
  label: string;
};

function pillClass(v: boolean | null) {
  if (v === null) return "pill unknown";
  return v ? "pill on" : "pill off";
}

function pillLabel(v: boolean | null) {
  if (v === null) return "نامشخص";
  return v ? "ON" : "OFF";
}

export function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceSerial, setDeviceSerial] = useState<string>("");
  const [network, setNetwork] = useState<NetworkStatus | null>(null);
  const [health, setHealth] = useState<{ hasOpenAIKey: boolean; model: string } | null>(
    null,
  );
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "سلام. گوشی را با USB وصل کن و بگو اینترنت را خاموش یا روشن کنم (Wi‑Fi، دیتا، یا حالت هواپیما).",
    },
  ]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSerial = useMemo(
    () => deviceSerial || devices.find((d) => d.status === "device")?.serial || "",
    [deviceSerial, devices],
  );

  async function refresh() {
    setError(null);
    try {
      const [h, d] = await Promise.all([
        fetch("/api/health").then((r) => r.json()),
        fetch("/api/devices").then((r) => r.json()),
      ]);
      setHealth(h);
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
      } else {
        setNetwork(null);
      }
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
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "" },
      ]);
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
        <p>
          دستیار تعمیرات نرم‌افزاری اندروید — فاز اول: خاموش و روشن کردن اینترنت گوشی از
          روی سیستم لینوکس تعمیرکار.
        </p>
      </header>

      <div className="layout">
        <aside className="panel">
          <h2>دستگاه و شبکه</h2>
          <div className="status-row">
            <span>OpenAI</span>
            <span className={health?.hasOpenAIKey ? "pill on" : "pill off"}>
              {health?.hasOpenAIKey ? health.model : "no key"}
            </span>
          </div>
          <div className="status-row">
            <span>ADB</span>
            <span className="pill unknown">{devices.length} device</span>
          </div>

          <div style={{ marginTop: 12 }}>
            <label className="muted" htmlFor="serial">
              سریال دستگاه
            </label>
            <select
              id="serial"
              value={selectedSerial}
              onChange={(e) => setDeviceSerial(e.target.value)}
              style={{
                width: "100%",
                marginTop: 6,
                padding: 8,
                borderRadius: 10,
                border: "1px solid var(--line)",
                background: "rgba(0,0,0,0.25)",
                color: "var(--ink)",
                font: "inherit",
              }}
            >
              <option value="">خودکار</option>
              {devices.map((d) => (
                <option key={d.serial} value={d.serial}>
                  {d.serial} ({d.status})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="status-row">
              <span>Wi‑Fi</span>
              <span className={pillClass(network?.wifiEnabled ?? null)}>
                {pillLabel(network?.wifiEnabled ?? null)}
              </span>
            </div>
            <div className="status-row">
              <span>دیتای موبایل</span>
              <span className={pillClass(network?.mobileDataEnabled ?? null)}>
                {pillLabel(network?.mobileDataEnabled ?? null)}
              </span>
            </div>
            <div className="status-row">
              <span>حالت هواپیما</span>
              <span className={pillClass(network?.airplaneMode ?? null)}>
                {pillLabel(network?.airplaneMode ?? null)}
              </span>
            </div>
          </div>

          <div className="actions" style={{ marginTop: 16 }}>
            <button className="secondary" type="button" onClick={() => void refresh()}>
              بروزرسانی
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
          <p className="muted" style={{ marginTop: 12 }}>
            پیش‌نیاز: adb روی PATH و USB debugging فعال باشد.
          </p>
        </aside>

        <section className="panel chat">
          <h2>گفتگو با Agent</h2>
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.content}
              </div>
            ))}
          </div>

          {pendingAction ? (
            <div className="confirm">
              <strong>تأیید عملیات لازم است:</strong>
              <span>{pendingAction.label}</span>
              <div className="actions">
                <button type="button" disabled={busy} onClick={() => void send(true)}>
                  تأیید و اجرا
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
              placeholder="مثلاً: اینترنت گوشی را خاموش کن"
              onChange={(e) => setInput(e.target.value)}
              onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(false);
                }
              }}
            />
            <div className="actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => void send(false)}
              >
                {busy ? "در حال اجرا..." : "ارسال"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
