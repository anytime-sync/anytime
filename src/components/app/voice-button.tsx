"use client";

import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { useUserPrefs } from "@/hooks/use-ai";
import { toast } from "sonner";

/**
 * VoiceButton — push-to-talk-ish dictation using the browser's native
 * SpeechRecognition (free, on-device on most modern browsers).
 *
 * Contract (matches the existing call sites in QuickAdd + InlineTaskInput):
 *   - onTranscript(text): interim results, fires repeatedly while speaking
 *   - onFinal(text): the final transcript when the recognizer commits
 *
 * Behavior:
 *   - Click to start; click again (or 1.8s of silence) to stop.
 *   - Recognition language follows the app's UI language so zh-TW
 *     dictation lands as Traditional Chinese, etc.
 *   - When the API isn't available (Firefox, embedded webviews) or the
 *     user has flipped ai_voice_enabled off, the button hides itself
 *     so we don't dangle a non-functional control.
 *
 * No audio leaves the device — Chrome/Edge ship Web Speech as a local
 * service; Safari uses the OS dictation engine.
 */

// Map our app language codes to BCP-47 tags the recognizer expects.
const RECOG_LANG: Record<string, string> = {
  en: "en-US",
  "zh-TW": "zh-TW",
  "zh-CN": "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
};

type Props = {
  onTranscript: (text: string) => void;
  onFinal: (text: string) => void;
  className?: string;
};

// Loose typing — the SpeechRecognition lib types aren't on the global
// DOM lib in TS by default. We narrow only what we actually use.
type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function VoiceButton({ onTranscript, onFinal, className }: Props) {
  const lang = useLanguage();
  const { data: prefs } = useUserPrefs();
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<SR | null>(null);
  const finalsRef = useRef<string>("");
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSupported(!!getRecognitionCtor());
  }, []);

  // Stop recognizer cleanly on unmount.
  useEffect(() => {
    return () => {
      try { recRef.current?.abort(); } catch {}
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  if (!supported) return null;
  if (prefs && prefs.ai_voice_enabled === false) return null;

  function startRecording() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const r = new Ctor();
    r.lang = RECOG_LANG[lang] ?? "en-US";
    r.continuous = true;
    r.interimResults = true;
    finalsRef.current = "";

    r.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        const transcript = res[0].transcript;
        if (res.isFinal) {
          finalsRef.current += transcript;
        } else {
          interim += transcript;
        }
      }
      const merged = (finalsRef.current + interim).trimStart();
      onTranscript(merged);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        try { r.stop(); } catch {}
      }, 1800);
    };

    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error(
          "Mic permission was denied. Allow microphone access in the site settings to dictate.",
        );
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        toast.error(`Voice input error: ${e.error}`);
      }
    };

    r.onend = () => {
      setRecording(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      const finalText = finalsRef.current.trim();
      if (finalText) onFinal(finalText);
      recRef.current = null;
    };

    recRef.current = r;
    setRecording(true);
    try {
      r.start();
    } catch (err) {
      setRecording(false);
      recRef.current = null;
      toast.error("Couldn't start dictation — try again.");
    }
  }

  function stopRecording() {
    try { recRef.current?.stop(); } catch {}
  }

  return (
    <button
      type="button"
      aria-label={recording ? "Stop dictation" : "Start dictation"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (recording) stopRecording();
        else startRecording();
      }}
      className={cn(
        "relative inline-flex items-center justify-center transition-all shrink-0",
        recording
          ? "h-8 px-2.5 gap-1.5 rounded-full bg-danger text-white"
          : "size-8 rounded-full text-muted-fg hover:text-fg hover:bg-muted",
        className,
      )}
    >
      {recording ? (
        <>
          <Mic className="size-3.5 shrink-0" />
          <span aria-hidden className="flex items-end gap-[2px] h-3.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-[2px] bg-white rounded-full animate-voice-bar"
                style={{ animationDelay: `${i * 90}ms` }}
              />
            ))}
          </span>
        </>
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  );
}

export { VoiceButton as MicButton };
