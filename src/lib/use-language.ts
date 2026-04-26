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
  useEffect(() => {
    setLang(readStoredLanguage());
    function onChange() { setLang(readStoredLanguage()); }
    function onStorage(e: StorageEvent) { if (e.key === LS_KEY) onChange(); }
    window.addEventListener("storage", onStorage);
    window.addEventListener("fl.language.change", onChange as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("fl.language.change", onChange as EventListener);
    };
  }, []);
  return lang;
}
