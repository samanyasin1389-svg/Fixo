import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "./i18n";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceInput(opts: {
  locale: Locale;
  enabled: boolean;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(opts.onFinal);
  const onErrorRef = useRef(opts.onError);

  useEffect(() => {
    onFinalRef.current = opts.onFinal;
  }, [opts.onFinal]);

  useEffect(() => {
    onErrorRef.current = opts.onError;
  }, [opts.onError]);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognitionCtor()));
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec) {
      try {
        rec.onend = null;
        rec.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    }
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    if (!opts.enabled) return;
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      onErrorRef.current?.("unsupported");
      return;
    }
    stop();
    const rec = new Ctor();
    rec.lang = opts.locale === "fa" ? "fa-IR" : "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      let finalText = "";
      let live = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i]![0]!.transcript;
        if (ev.results[i]!.isFinal) finalText += piece;
        else live += piece;
      }
      if (live) setInterim(live);
      if (finalText.trim()) {
        setInterim("");
        onFinalRef.current(finalText.trim());
      }
    };

    rec.onerror = (ev) => {
      setListening(false);
      setInterim("");
      if (ev.error === "aborted" || ev.error === "no-speech") return;
      onErrorRef.current?.(ev.error);
    };

    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
      setInterim("");
    } catch {
      onErrorRef.current?.("start_failed");
      setListening(false);
    }
  }, [opts.enabled, opts.locale, stop]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { supported, listening, interim, start, stop, toggle };
}
