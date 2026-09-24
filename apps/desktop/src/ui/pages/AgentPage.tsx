import type { RefObject } from "react";
import type { Locale } from "../i18n";
import { t } from "../i18n";
import { useVoiceInput } from "../useVoiceInput";

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
  onVoiceSend: (text: string) => void;
  onCancelPending: () => void;
  onVoiceError?: (key: string) => void;
};

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {active ? (
        <path
          fill="currentColor"
          d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"
        />
      )}
    </svg>
  );
}

export function AgentPage({
  locale,
  messages,
  pendingAction,
  input,
  inputRef,
  busy,
  onInput,
  onSend,
  onVoiceSend,
  onCancelPending,
  onVoiceError,
}: AgentPageProps) {
  const voice = useVoiceInput({
    locale,
    enabled: !busy,
    onFinal: (text) => {
      onVoiceSend(text);
    },
    onError: (code) => onVoiceError?.(code),
  });

  return (
    <section className="panel chat panel-chat">
      <div className="agent-head">
        <h2>{t(locale, "chat")}</h2>
        <p className="muted tiny agent-voice-hint">{t(locale, "voiceHint")}</p>
      </div>

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

      {voice.listening || voice.interim ? (
        <p className="voice-live muted" aria-live="polite">
          {voice.listening ? t(locale, "voiceListening") : null}
          {voice.interim ? ` ${voice.interim}` : null}
        </p>
      ) : null}

      <div className="composer composer-with-mic">
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
        <div className="composer-actions">
          <button
            type="button"
            className={`mic-btn${voice.listening ? " listening" : ""}`}
            disabled={busy || !voice.supported}
            title={
              voice.supported ? t(locale, "voiceTalk") : t(locale, "voiceUnsupported")
            }
            aria-label={t(locale, "voiceTalk")}
            aria-pressed={voice.listening}
            onClick={() => voice.toggle()}
          >
            <MicIcon active={voice.listening} />
          </button>
          <button type="button" disabled={busy} onClick={() => onSend(false)}>
            {busy ? t(locale, "sending") : t(locale, "send")}
          </button>
        </div>
      </div>
    </section>
  );
}
