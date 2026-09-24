import type { RefObject } from "react";
import type { Locale } from "../i18n";
import { t } from "../i18n";

type Msg = { role: "user" | "assistant"; content: string };
type PendingAction = { tool: string; label: string };

type AgentPageProps = {
  locale: Locale;
  messages: Msg[];
  pendingAction: PendingAction | null;
  input: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  busy: boolean;
  onInput: (value: string) => void;
  onSend: (confirm?: boolean) => void;
  onCancelPending: () => void;
};

export function AgentPage({
  locale,
  messages,
  pendingAction,
  input,
  inputRef,
  busy,
  onInput,
  onSend,
  onCancelPending,
}: AgentPageProps) {
  return (
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
            <button type="button" disabled={busy} onClick={() => onSend(true)}>
              {t(locale, "confirm")}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={onCancelPending}
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
          onChange={(e) => onInput(e.target.value)}
          onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend(false);
            }
          }}
        />
        <button type="button" disabled={busy} onClick={() => onSend(false)}>
          {busy ? t(locale, "sending") : t(locale, "send")}
        </button>
      </div>
    </section>
  );
}
