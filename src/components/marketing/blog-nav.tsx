"use client";

import Link from "next/link";
import { LanguagePicker } from "@/components/app/language-picker";
import { readStoredLanguage, type LanguageCode } from "@/lib/i18n";
import { useEffect, useState } from "react";

/**
 * Shared top nav for blog pages — matches the pricing/landing nav
 * and includes the LanguagePicker.
 */
export function BlogNav({
  activePage = "blog",
  onLangChange,
}: {
  activePage?: "blog" | "post";
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
    <header className="border-b border-border mb-12 -mx-4 md:-mx-6 px-4 md:px-6">
      <div className="max-w-2xl mx-auto h-14 flex items-center justify-between">
        <Link href="/" className="wordmark text-base">
          First Light
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-fg">
          <Link href="/pricing" className="hover:text-fg transition-colors">
            Pricing
          </Link>
          <Link
            href="/blog"
            className={
              activePage === "blog"
                ? "font-medium text-fg"
                : "hover:text-fg transition-colors"
            }
          >
            Blog
          </Link>
          <LanguagePicker mode="local" onChange={handleChange} />
        </nav>
      </div>
    </header>
  );
}
