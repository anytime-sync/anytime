"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_LANGUAGE,
  readStoredLanguage,
  type LanguageCode,
} from "@/lib/i18n";

const LS_KEY = "fl.language";

/**
 * useLanguage — React hook returning the current language code.
 *
 * Lives in its own file so the (server-safe) i18n.ts can be imported
 * by API routes and prompt builders without dragging React into the
 * server bundle.
 *
 * Listens to:
 *   - 'storage' (cross-tab updates)
 *   - 'fl.language.change' (same-tab updates dispatched by writeStoredLanguage)
 */
export function useLanguage(): LanguageCode {
  const [lang, setLang] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  // `_v` is a hidden re-render counter. We bump it whenever runtime
  // i18n overrides change, so every `t()` consumer that calls
  // useLanguage() re-evaluates with the fresh override map without
  // needing to also call a separate hook.
  const [, setOverrideVersion] = useState(0);
  useEffect(() => {
    setLang(readStoredLanguage());
    function onChange() { setLang(readStoredLanguage()); }
    function onStorage(e: StorageEvent) { if (e.key === LS_KEY) onChange(); }
    function onOverrides() { setOverrideVersion((v) => v + 1); }
    window.addEventListener("storage", onStorage);
    window.addEventListener("fl.language.change", onChange as EventListener);
    window.addEventListener(
      "fl.i18n.overrides-changed",
      onOverrides as EventListener
    );
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("fl.language.change", onChange as EventListener);
      window.removeEventListener(
        "fl.i18n.overrides-changed",
        onOverrides as EventListener
      );
    };
  }, []);
  return lang;
}
