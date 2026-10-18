"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { t, readStoredLanguage, type LanguageCode } from "@/lib/i18n";

const featureRows = [
  {
    "feature": "Task planning",
    "fl": "Tasks with optional AI suggestions",
    "comp": "Today, Upcoming, Anytime and Someday"
  },
  {
    "feature": "Calendar",
    "fl": "Google events; editing on Plus/Pro",
    "comp": "Apple Calendar events in Today and Upcoming"
  },
  {
    "feature": "Focus and habits",
    "fl": "Focus timer and habit tracking",
    "comp": "See current product features"
  },
  {
    "feature": "Integrations",
    "fl": "API/MCP on Pro; setup required",
    "comp": "Apple Shortcuts and other automation"
  },
  {
    "feature": "Platforms",
    "fl": "Web/PWA; online saving and sync",
    "comp": "Apple devices"
  },
  {
    "feature": "Price",
    "fl": "Free and paid subscriptions",
    "comp": "See official purchase options"
  }
];

const whenFL = ["compare.things.whenFL.1","compare.things.whenFL.2","compare.things.whenFL.3","compare.things.whenFL.4"] as const;
const whenComp = ["compare.things.whenComp.1","compare.things.whenComp.2","compare.things.whenComp.3","compare.things.whenComp.4"] as const;

export default function CompareThingsPage() {
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
          {t(lang, "compare.kicker.detail")}
        </p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-[1.15] mb-4">
          {t(lang, "compare.things.heading")}
        </h1>
        <p className="text-muted-fg text-base leading-relaxed mb-2">
          {t(lang, "compare.things.body")}
        </p>
        <p className="text-muted-fg text-sm">{t(lang, "compare.updated")} · <a href="https://culturedcode.com/things/features/" className="underline">Official product documentation</a> · <Link href="/pricing" className="underline">First Light plans</Link></p>
      </section>

      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-3 bg-stone-50 border-b border-border">
            <div className="px-4 py-3 text-xs font-medium text-muted-fg uppercase tracking-wider">{t(lang, "compare.table.feature")}</div>
            <div className="px-4 py-3 text-xs font-medium text-center uppercase tracking-wider">{t(lang, "compare.table.fl")}</div>
            <div className="px-4 py-3 text-xs font-medium text-center text-muted-fg uppercase tracking-wider">Things 3</div>
          </div>
          {featureRows.map((row, i) => (
            <div key={i} className={`grid grid-cols-3 border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-stone-50/50"}`}>
              <div className="px-4 py-3 text-sm font-medium">{row.feature}</div>
              <div className="px-4 py-3 text-sm text-center">{row.fl}</div>
              <div className="px-4 py-3 text-sm text-center text-muted-fg">{row.comp}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-16 max-w-3xl mx-auto space-y-6">
        <h2 className="font-display text-2xl tracking-tight">{t(lang, "compare.whenFL")}</h2>
        <ul className="space-y-2 text-sm text-muted-fg">
          {whenFL.map((k) => (
            <li key={k} className="flex gap-2"><span className="text-green-600 shrink-0">✓</span>{t(lang, k)}</li>
          ))}
        </ul>
        <h2 className="font-display text-2xl tracking-tight">{t(lang, "compare.whenComp")} Things 3</h2>
        <ul className="space-y-2 text-sm text-muted-fg">
          {whenComp.map((k) => (
            <li key={k} className="flex gap-2"><span className="text-blue-600 shrink-0">✓</span>{t(lang, k)}</li>
          ))}
        </ul>
      </section>

      <section className="px-6 py-16 text-center">
        <h2 className="font-display text-2xl tracking-tight mb-4">{t(lang, "compare.cta.heading")}</h2>
        <p className="text-muted-fg text-sm mb-8 max-w-md mx-auto">{t(lang, "compare.cta.subheading")}</p>
        <Link href="/signup" className="px-8 py-3 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition">
          {t(lang, "compare.cta.button")}
        </Link>
      </section>
    </div>
  );
}
