"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { t, readStoredLanguage, type LanguageCode } from "@/lib/i18n";

const comparisons = [
  { slug: "todoist", nameKey: "compare.todoist.heading" as const },
  { slug: "things", nameKey: "compare.things.heading" as const },
  { slug: "ticktick", nameKey: "compare.ticktick.heading" as const },
];

export default function ComparePage() {
  const [lang, setLang] = useState<LanguageCode>("en");

  useEffect(() => {
    setLang(readStoredLanguage());
    const handler = (e: StorageEvent) => {
      if (e.key === "fl.language") setLang(readStoredLanguage());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav lang={lang} onLangChange={setLang} activePage="compare" />

      <section className="px-6 pt-16 pb-12 max-w-3xl mx-auto">
        <p className="text-xs tracking-[0.22em] uppercase text-muted-fg mb-4">
          {t(lang, "compare.kicker")}
        </p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-[1.15] mb-6">
          {t(lang, "compare.heading")}
        </h1>
        <p className="text-muted-fg text-base leading-relaxed">
          {t(lang, "compare.subheading")}
        </p>
      </section>

      <section className="px-6 pb-20 max-w-3xl mx-auto space-y-4">
        {comparisons.map((c) => (
          <Link
            key={c.slug}
            href={"/compare/" + c.slug}
            className="block border border-border rounded-xl p-6 hover:border-foreground/20 transition group"
          >
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-display text-xl tracking-tight group-hover:underline">
                {t(lang, c.nameKey)}
              </h2>
              <span className="text-xs text-muted-fg">→</span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
