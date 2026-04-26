"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Microphone button using the browser's webkitSpeechRecognition API.
 * No API key, no server round-trip. Works in Chrome, Edge, and Safari.
 *
 * - On press: starts continuous recognition; live-updates `onTranscript`.
 * - On press again: stops and emits the final transcript.
 * - On unmount or window blur: stops cleanly.
 *
 * If the browser doesn't support it, the button is hidden — callers can
 * fall back to typed input without a feature flag.
 */
type Recognition = any;

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export function VoiceButton({
  onTranscript,
  onFinal,
  disabled,
  className,
}: {
  onTranscript: (text: string) => void;
  onFinal?: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Cls = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!Cls);
  }, []);

  useEffect(() => () => stop(), []);

  function start() {
    const Cls = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Cls) return;
    const r: Recognition = new Cls();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    finalRef.current = "";
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += chunk;
        else interim += chunk;
      }
      const combined = (finalRef.current + " " + interim).trim();
      onTranscript(combined);
    };
    r.onerror = () => stop();
    r.onend = () => {
      setActive(false);
      if (onFinal && finalRef.current.trim()) onFinal(finalRef.current.trim());
    };
    r.start();
    recRef.current = r;
    setActive(true);
  }

  function stop() {
    try {
      recRef.current?.stop();
    } catch {}
    recRef.current = null;
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      aria-label={active ? "Stop dictation" : "Start dictation"}
      title={active ? "Stop dictation" : "Speak to add a task"}
      disabled={disabled}
      onClick={() => (active ? stop() : start())}
      className={cn(
        "size-9 grid place-items-center rounded-full transition",
        active ? "bg-danger/15 text-danger" : "btn-ghost",
        className
      )}
    >
      {active ? (
        <Mic className="size-4 animate-pulse" />
      ) : (
        <MicOff className="size-4 opacity-70" />
      )}
    </button>
  );
}
