"use client";

import { t, type LanguageCode } from "@/lib/i18n";

/**
 * FeatureGrid — compact grid of features that were demoted from the main carousel.
 * Shows icon/emoji + name + one-liner in a responsive grid.
 */

type Feature = { emoji: string; nameKey: string; descKey: string };

const features: Feature[] = [
  { emoji: "📋", nameKey: "landing.features.f1.name", descKey: "landing.features.f1.desc" },
  { emoji: "🧭", nameKey: "landing.features.f2.name", descKey: "landing.features.f2.desc" },
  { emoji: "📅", nameKey: "landing.features.f3.name", descKey: "landing.features.f3.desc" },
  { emoji: "👥", nameKey: "landing.features.f4.name", descKey: "landing.features.f4.desc" },
  { emoji: "📸", nameKey: "landing.features.f5.name", descKey: "landing.features.f5.desc" },
  { emoji: "🤖", nameKey: "landing.features.f6.name", descKey: "landing.features.f6.desc" },
  { emoji: "✅", nameKey: "landing.features.f7.name", descKey: "landing.features.f7.desc" },
  { emoji: "🎯", nameKey: "landing.features.f8.name", descKey: "landing.features.f8.desc" },
  { emoji: "📝", nameKey: "landing.features.f9.name", descKey: "landing.features.f9.desc" },
  { emoji: "🎯", nameKey: "landing.features.f10.name", descKey: "landing.features.f10.desc" },
  { emoji: "🔍", nameKey: "landing.features.f11.name", descKey: "landing.features.f11.desc" },
  { emoji: "🔔", nameKey: "landing.features.f12.name", descKey: "landing.features.f12.desc" },
  { emoji: "📧", nameKey: "landing.features.f13.name", descKey: "landing.features.f13.desc" },
  { emoji: "⏰", nameKey: "landing.features.f14.name", descKey: "landing.features.f14.desc" },
  { emoji: "🌙", nameKey: "landing.features.f15.name", descKey: "landing.features.f15.desc" },
  { emoji: "💬", nameKey: "landing.features.f16.name", descKey: "landing.features.f16.desc" },
  { emoji: "📰", nameKey: "landing.features.f17.name", descKey: "landing.features.f17.desc" },
];

export function FeatureGrid({ lang = "en" }: { lang?: LanguageCode }) {
  return (
    <section className="px-6 py-12 max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <p className="editorial-number text-xs mb-2">{t(lang, "landing.features.kicker")} {features.length}</p>
        <h3 className="font-display text-xl tracking-tight">{t(lang, "landing.features.heading")}</h3>
        <p className="text-muted-fg dark:text-white/60 text-sm mt-1">
          {t(lang, "landing.features.subheading")}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {features.map((f) => (
          <div
            key={f.nameKey}
            className="flex items-start gap-3 px-4 py-3 rounded-xl border border-border dark:border-white/15 bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/15 transition-colors"
          >
            <span className="text-lg shrink-0 mt-0.5">{f.emoji}</span>
            <div className="min-w-0">
              <p className="font-medium text-sm text-fg dark:text-white">{t(lang, f.nameKey as Parameters<typeof t>[1])}</p>
              <p className="text-xs text-muted-fg dark:text-white/60">{t(lang, f.descKey as Parameters<typeof t>[1])}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
