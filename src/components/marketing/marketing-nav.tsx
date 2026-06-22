"use client";

/**
 * MarketingNav — shared top-bar for all public marketing pages.
 *
 * Includes:
 *   • "← First Light" back-to-home link (wordmark)
 *   • Optional page-level nav links (e.g. Pricing, Compare)
 *   • LanguagePicker in local mode (reads/writes localStorage)
 *   • Sign-in / Start-free CTAs (auth-aware, lazy)
 *
 * Usage:
 *   <MarketingNav lang={lang} onLangChange={setLang} activePage="pricing" />
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LanguagePicker } from "@/components/app/language-picker";
import { t, type LanguageCode } from "@/lib/i18n";

type ActivePage = "pricing" | "compare" | "blog" | "features" | null;

export function MarketingNav({
  lang,
  onLangChange,
  activePage = null,
}: {
  lang: LanguageCode;
  onLangChange: (code: LanguageCode) => void;
  activePage?: ActivePage;
}) {
  const [authState, setAuthState] = useState<"loading" | "out" | "in">("loading");

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => {
      setAuthState(data.user ? "in" : "out");
    });
  }, []);

  return (
    <header className="border-b border-border sticky top-0 z-50 bg-bg/95 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: wordmark + back-to-home */}
        <Link
          href="/"
          className="wordmark text-[21px] flex items-center gap-3 shrink-0 hover:opacity-80 transition-opacity"
          title={t(lang, "nav.backToHome")}
        >
          <img src="/logo-black.png" alt="" className="size-9 block dark:hidden" aria-hidden="true" />
          <img src="/logo-white.png" alt="" className="size-9 hidden dark:block" aria-hidden="true" />
          First Light
        </Link>

        {/* Centre: page nav links */}
        <nav className="hidden sm:flex items-center gap-5 text-sm text-muted-fg">
          <Link
            href="/pricing"
            className={`hover:text-fg transition-colors ${activePage === "pricing" ? "text-fg font-medium" : ""}`}
          >
            {t(lang, "landing.nav.pricing")}
          </Link>
          <Link
            href="/compare"
            className={`hover:text-fg transition-colors ${activePage === "compare" ? "text-fg font-medium" : ""}`}
          >
            {t(lang, "landing.nav.compare")}
          </Link>
          <Link
            href="/blog"
            className={`hover:text-fg transition-colors ${activePage === "blog" ? "text-fg font-medium" : ""}`}
          >
            {t(lang, "landing.nav.blog")}
          </Link>
        </nav>

        {/* Right: lang toggle + auth CTAs */}
        <div className="flex items-center gap-2 shrink-0">
          <LanguagePicker mode="local" onChange={onLangChange} />

          {authState === "loading" ? (
            <div className="h-8 w-20 rounded-md bg-muted/40 animate-pulse" />
          ) : authState === "in" ? (
            <Link href="/app/today" className="btn-ghost h-8 px-3 text-sm">
              {t(lang, "nav.openApp")}
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-muted-fg hover:text-fg text-sm hidden sm:inline transition-colors">
                {t(lang, "auth.login.submit")}
              </Link>
              <Link href="/signup" className="btn-primary h-8 px-3 text-sm">
                {t(lang, "landing.signupCta")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
