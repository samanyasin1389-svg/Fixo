import { useEffect, useRef, useState } from "react";

export type ToastKind = "info" | "success" | "error";

export type ToastItem = {
  id: number;
  message: string;
  kind: ToastKind;
};

const DURATION_MS = 10_000;

type ToastHostProps = {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const [progress, setProgress] = useState(100);
  const started = useRef(Date.now());

  useEffect(() => {
    started.current = Date.now();
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - started.current;
      const left = Math.max(0, 100 - (elapsed / DURATION_MS) * 100);
      setProgress(left);
      if (elapsed >= DURATION_MS) {
        onDismiss(toast.id);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [toast.id, onDismiss]);

  return (
    <div className={`toast toast-${toast.kind}`} role="status">
      <div className="toast-progress" aria-hidden="true">
        <div className="toast-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="toast-body">
        <p className="toast-message">{toast.message}</p>
        <button
          type="button"
          className="toast-close"
          aria-label="Dismiss"
          onClick={() => onDismiss(toast.id)}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function ToastHost({ toasts, onDismiss }: ToastHostProps) {
  if (!toasts.length) return null;
  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function useToastQueue() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  function pushToast(message: string, kind: ToastKind = "info") {
    const trimmed = message.trim();
    if (!trimmed) return;
    const id = idRef.current++;
    setToasts((prev) => [...prev, { id, message: trimmed, kind }].slice(-4));
  }

  function dismissToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return { toasts, pushToast, dismissToast };
}

export const TOAST_DURATION_MS = DURATION_MS;
