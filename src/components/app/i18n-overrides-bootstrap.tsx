"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  LANGUAGES,
  readStoredLanguage,
  setI18nOverrides,
  type LanguageCode,
} from "@/lib/i18n";

/**
 * Patches the DOM directly so admin-edited text shows up even if the
 * React tree never re-renders (e.g. when a stale `useLanguage` chunk
 * is served from build cache and lacks the overrides-change listener).
 *
 * For every element with `data-design-text-key`, look up the override
 * for the current locale and write it into textContent. We do this on
 * the next animation frame so React's own initial paint commits first.
 */
function patchTextDom(
  overrides: Partial<Record<LanguageCode, Record<string, string>>>
) {
  if (typeof window === "undefined") return;
  const code = readStoredLanguage();
  const map = overrides[code] ?? {};
  const els = document.querySelectorAll<HTMLElement>("[data-design-text-key]");
  els.forEach((el) => {
    const key = el.dataset.designTextKey;
    if (!key) return;
    const value = map[key];
    // Only patch when there's an override for THIS locale AND it differs
    // from what's already rendered. We deliberately don't fall back to
    // the English override here — that would replace correctly-translated
    // hardcoded strings with the English version.
    if (typeof value === "string" && value && el.textContent !== value) {
      el.textContent = value;
    }
  });
}

/**
 * Loads runtime translation overrides from `site_content` and seeds
 * the i18n override map for every locale. Mounted at the root so
 * every page (landing, /app/*, /admin/*) sees admin-edited text.
 *
 * Also listens for postMessages of type `fl.design.text` so the
 * /admin/design iframe — which double-clicks-to-edit live — sees
 * the new value reflected immediately on the next render.
 *
 * The first paint shows hardcoded defaults; once site_content arrives
 * (a single round-trip) the component bumps state and the tree re-
 * renders with overrides. This is acceptable — the flash is at most
 * one network round-trip, the rest is hardcoded.
 */
export function I18nOverridesBootstrap() {
  const [, bump] = useState(0);
  const cacheRef = useRef<Partial<Record<LanguageCode, Record<string, string>>>>(
    {}
  );

  // Initial load — pull every override row, group by locale, push to i18n.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("site_content")
          .select("locale, key, value");
        if (cancelled || !data) return;
        const grouped: Partial<Record<LanguageCode, Record<string, string>>> = {};
        for (const row of data as Array<{
          locale: string;
          key: string;
          value: string;
        }>) {
          const code = LANGUAGES.find((l) => l.code === row.locale)?.code;
          if (!code) continue;
          (grouped[code] ??= {})[row.key] = row.value;
        }
        cacheRef.current = grouped;
        for (const code of Object.keys(grouped) as LanguageCode[]) {
          setI18nOverrides(code, grouped[code]!);
        }
        bump((n) => n + 1);
        // Tell every useLanguage() consumer to re-render. Without this the
        // override map mutates but the tree keeps showing hardcoded
        // defaults until some other state change forces a render.
        window.dispatchEvent(new Event("fl.i18n.overrides-changed"));
        // Belt-and-suspenders: directly patch any rendered text-key
        // elements in the DOM. This unblocks the case where the
        // useLanguage listener hasn't been deployed yet (Vercel build
        // cache occasionally hands back a stale compiled chunk).
        requestAnimationFrame(() => patchTextDom(grouped));
      } catch {
        // Ignore — fall back to hardcoded defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live patch from the design editor's inline text save.
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const data = ev.data as
        | { type: "fl.design.text"; textKey: string; value: string; locale: string }
        | undefined;
      if (!data || typeof data !== "object" || data.type !== "fl.design.text") return;
      const code = LANGUAGES.find((l) => l.code === data.locale)?.code;
      if (!code) return;
      const current = cacheRef.current[code] ?? {};
      const next = { ...current };
      const trimmed = data.value.trim();
      if (trimmed) next[data.textKey] = trimmed;
      else delete next[data.textKey];
      cacheRef.current[code] = next;
      setI18nOverrides(code, next);
      bump((n) => n + 1);
      window.dispatchEvent(new Event("fl.i18n.overrides-changed"));
      requestAnimationFrame(() => patchTextDom(cacheRef.current));
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return null;
}
