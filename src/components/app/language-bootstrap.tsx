"use client";

import { useEffect } from "react";
import { readStoredLanguage, type LanguageCode } from "@/lib/i18n";

/**
 * LanguageBootstrap — sets <html lang=...> from the stored language
 * preference, AND swaps the meta description to the matching locale's
 * poetic First Light tagline. Mounted once in the root layout body.
 *
 * The lang attribute drives the per-language font stacks defined in
 * globals.css (e.g. [lang="zh-TW"] { --font-sans: 'Noto Sans TC', ... }).
 *
 * The meta description swap means search engines and link-preview
 * crawlers see the canonical English line (set in layout.tsx
 * `metadata.description`), while visitors see their language in the
 * browser tab and any client-side OG readers that re-resolve.
 *
 * Listens for storage events so a language change in another tab
 * also updates this one without a refresh, and for the same-tab
 * `fl.language.change` event dispatched by writeStoredLanguage.
 */

const META_DESCRIPTIONS: Record<LanguageCode, string> = {
  en: "First Light · A calm daily productivity tool for getting things done.",
  "zh-TW":
    "First Light · 如晨光般沉靜，讓每日要做的事 從容落定。",
  "zh-CN":
    "First Light · 如晨光般沉静，让每日要做的事 从容落定。",
  ja: "First Light · 朝のひかりのように、静かに、たしかに。日々のやるべきことを整える生産性ツール。",
  ko: "First Light · 첫 빛처럼 잔잔하게, 하루의 할 일을 정성스레 매듭짓는 생산성 도구.",
};

function applyMetaDescription(lang: LanguageCode) {
  const desc = META_DESCRIPTIONS[lang] ?? META_DESCRIPTIONS.en;
  // Update the standard description meta. We also update og:description
  // and twitter:description if they're present so link-preview cards
  // pulled by clients (e.g. some chat apps) reflect the localized copy.
  for (const sel of [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
  ]) {
    const tag = document.querySelector(sel) as HTMLMetaElement | null;
    if (tag) tag.content = desc;
  }
}

export function LanguageBootstrap() {
  useEffect(() => {
    function applyAll() {
      const lang = readStoredLanguage();
      document.documentElement.lang = lang;
      applyMetaDescription(lang);
    }
    applyAll();
    function onStorage(e: StorageEvent) {
      if (e.key === "fl.language") applyAll();
    }
    function onChange() {
      applyAll();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("fl.language.change", onChange as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "fl.language.change",
        onChange as EventListener
      );
    };
  }, []);
  return null;
}
