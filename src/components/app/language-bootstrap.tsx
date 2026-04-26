"use client";

import { useEffect } from "react";
import { readStoredLanguage } from "@/lib/i18n";

/**
 * LanguageBootstrap — sets <html lang=...> from the stored language
 * preference. Mounted once in the root layout body. The lang attribute
 * is what drives the per-language font stacks defined in globals.css
 * (e.g. [lang="zh-TW"] { --font-sans: 'Noto Sans TC', ... }).
 *
 * Listens for storage events so a language change in another tab
 * also updates this one without a refresh.
 */
export function LanguageBootstrap() {
  useEffect(() => {
    document.documentElement.lang = readStoredLanguage();
    function onStorage(e: StorageEvent) {
      if (e.key === "fl.language") {
        document.documentElement.lang = readStoredLanguage();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
