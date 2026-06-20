"use client";

import Link from "next/link";
import { LanguagePicker } from "@/components/app/language-picker";
import { readStoredLanguage, type LanguageCode } from "@/lib/i18n";
import { useEffect, useState } from "react";

/**
 * Shared top nav for blog pages — identical layout to the landing page nav:
 * FIRST LIGHT wordmark (left), Pricing + Blog + LanguagePicker (right).
 */
export function BlogNav({
  onLangChange,
}: {
  onLangChange?: (code: LanguageCode) => void;
}) {
  const [lang, setLang] = useState<LanguageCode>("en");

  useEffect(() => {
    setLang(readStoredLanguage());
  }, []);

  function handleChange(code: LanguageCode) {
    setLang(code);
    onLangChange?.(code);
  }

  return (
    <header className="px-4 md:px-6 pt-6 md:pt-8">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
        <Link href="/" className="shrink-0">
          <span className="wordmark text-[21px] flex items-center gap-3">
            <img src="/logo-black.png" alt="" className="size-9 block dark:hidden" aria-hidden="true" />
            <img src="/logo-white.png" alt="" className="size-9 hidden dark:block" aria-hidden="true" />
            First Light
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-fg">
          <Link
            href="/pricing"
            className="hover:text-fg transition-colors hidden sm:inline"
          >
            Pricing
          </Link>
          <Link
            href="/compare"
            className="hover:text-fg transition-colors hidden sm:inline"
          >
            Compare
          </Link>
          <Link
            href="/blog"
            className="hover:text-fg transition-colors hidden sm:inline"
          >
            Blog
          </Link>
          <LanguagePicker mode="local" onChange={handleChange} />
        </nav>
      </div>
    </header>
  );
}
