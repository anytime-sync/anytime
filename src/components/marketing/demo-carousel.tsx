"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { t, type LanguageCode } from "@/lib/i18n";

/**
 * DemoCarousel — 4-card "See it in motion" strip for the landing page.
 * Shows the four most distinctive First Light surfaces as inline mockups.
 */
export function DemoCarousel({ lang = "en" }: { lang?: LanguageCode }) {
  const demosRef = useRef<HTMLDivElement>(null);
  function scrollDemos(direction: 1 | -1) {
    const el = demosRef.current;
    if (!el) return;
    const card = el.querySelector("figure") as HTMLElement | null;
    const step = (card?.offsetWidth ?? 280) + 16;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  return (
    <>
      <section className="mb-16">
        <div className="flex items-end justify-between mb-3 gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-3xl tracking-tight">{t(lang, "landing.demo.heading")}</h2>
            <p className="text-muted-fg text-sm md:text-base max-w-xl mt-2">
              {t(lang, "landing.demo.subheading")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => scrollDemos(-1)}
              aria-label="Previous demos"
              className="size-10 rounded-full border border-border hover:bg-muted/60 grid place-items-center transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => scrollDemos(1)}
              aria-label="More demos"
              className="size-10 rounded-full border border-border hover:bg-muted/60 grid place-items-center transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <div
          ref={demosRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 -mx-6 px-6 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {/* 1 — Daily Edition */}
          <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-gradient-to-br from-amber-50/60 to-stone-50 shadow-sm">
            <div className="aspect-[4/3] p-5 flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">{t(lang, "landing.demo.card1.kicker")}</p>
                <p className="text-[8px] text-stone-400">May 13</p>
              </div>
              <p className="font-display text-base md:text-lg leading-tight text-stone-800">{t(lang, "landing.demo.card1.title")}</p>
              <p className="text-[11px] text-stone-700 leading-snug">{t(lang, "landing.demo.card1.body1")}</p>
              <p className="text-[10px] text-stone-600 leading-snug">{t(lang, "landing.demo.card1.body2")}</p>
              <p className="text-[10px] italic text-stone-500 border-t border-stone-200/70 pt-1.5 mt-auto leading-snug">{t(lang, "landing.demo.card1.closing")}</p>
            </div>
            <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
              <p className="font-medium text-sm">{t(lang, "landing.demo.card1.name")}</p>
              <p className="text-xs text-muted-fg">{t(lang, "landing.demo.card1.desc")}</p>
            </figcaption>
          </figure>

          {/* 2 — MCP / AI Assistant */}
          <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-gradient-to-br from-violet-50/60 to-stone-50 shadow-sm">
            <div className="aspect-[4/3] p-5 flex flex-col gap-2">
              <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">{t(lang, "landing.demo.card2.kicker")}</p>
              <div className="bg-white border border-stone-200 rounded-xl p-3 flex-1 flex flex-col gap-2">
                <div className="bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5 text-[10px] text-violet-900">
                  <span className="text-[8px] tracking-[0.18em] text-violet-500">YOU → CLAUDE</span>
                  <p className="mt-0.5 italic">&ldquo;Plan my day around the 2pm meeting&rdquo;</p>
                </div>
                <div className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-[10px] text-stone-700">
                  <span className="text-[8px] tracking-[0.18em] text-stone-400">CLAUDE → FIRST LIGHT</span>
                  <p className="mt-0.5">Calling <span className="font-mono text-[9px] bg-stone-100 px-1 rounded">plan_day</span>...</p>
                </div>
                <div className="bg-accent/10 border border-accent/30 rounded-lg px-2.5 py-1.5 text-[10px]">
                  <span className="text-[8px] tracking-[0.18em] text-stone-500">RESULT</span>
                  <p className="mt-0.5 text-stone-800">✓ 4 tasks reorganized. Deep work blocked 10-12am. Post-meeting admin at 3:30pm.</p>
                </div>
              </div>
            </div>
            <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
              <p className="font-medium text-sm">{t(lang, "landing.demo.card2.name")}</p>
              <p className="text-xs text-muted-fg">{t(lang, "landing.demo.card2.desc")}</p>
            </figcaption>
          </figure>

          {/* 3 — Voice / Snapshot / Paste → Task */}
          <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
            <div className="aspect-[4/3] p-5 flex flex-col gap-2">
              <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">{t(lang, "landing.demo.card3.kicker")}</p>
              <div className="bg-white border border-stone-200 rounded-xl p-2.5 flex items-center gap-2">
                <div className="h-7 px-2 inline-flex items-center gap-1 rounded-full bg-rose-500 text-white shrink-0">
                  <div className="size-2.5 rounded-full bg-white" />
                  <span className="flex items-end gap-[1.5px] h-3">
                    {[5, 8, 12, 7, 4].map((h, i) => (
                      <span key={i} className="w-[2px] bg-white rounded-full" style={{ height: h + "px" }} />
                    ))}
                  </span>
                </div>
                <p className="text-[10px] text-stone-700 italic truncate flex-1 min-w-0">&ldquo;Draft Q4 strategy doc by Thursday 5pm&rdquo;</p>
              </div>
              <div className="text-[9px] text-stone-400 text-center">↓ AI parses</div>
              <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px] flex items-start gap-2">
                <div className="size-3.5 rounded-full border-2 border-stone-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-stone-800 font-medium truncate">Draft Q4 strategy doc</p>
                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    <span className="text-[8px] italic text-stone-500">Thu · 5:00 PM</span>
                    <span className="text-[8px] italic text-stone-500">· High</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-auto pt-1">
                <span className="text-[8px] tracking-[0.18em] text-stone-400">OR</span>
                <span className="text-[9px] text-stone-600">Snapshot a whiteboard →</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">5 tasks</span>
              </div>
            </div>
            <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
              <p className="font-medium text-sm">{t(lang, "landing.demo.card3.name")}</p>
              <p className="text-xs text-muted-fg">{t(lang, "landing.demo.card3.desc")}</p>
            </figcaption>
          </figure>

          {/* 4 — Weekly Review */}
          <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-gradient-to-br from-stone-50 to-amber-50/40 shadow-sm">
            <div className="aspect-[4/3] p-5 flex flex-col gap-2">
              <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">{t(lang, "landing.demo.card4.kicker")}</p>
              <p className="font-display text-base text-stone-800 leading-tight">{t(lang, "landing.demo.card4.title")}</p>
              <div className="bg-white border border-stone-200 rounded-md p-2 text-[10px]">
                <p className="text-[7px] tracking-[0.2em] text-stone-400 mb-1">LAST WEEK</p>
                <p className="text-stone-700 leading-snug">14 done · 3 carried · best morning Tue.</p>
              </div>
              <div className="bg-accent/10 border border-accent/30 rounded-md p-2 text-[10px]">
                <p className="text-[7px] tracking-[0.2em] text-stone-500 mb-1">NEXT WEEK · PREVIEW</p>
                <p className="text-stone-700 leading-snug">3 deep-work blocks pre-staged. Mon 10am, Wed 9am, Thu 1pm.</p>
              </div>
              <p className="text-[9px] text-stone-500 italic mt-auto">A Friday-style retro that actually surfaces patterns.</p>
            </div>
            <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
              <p className="font-medium text-sm">{t(lang, "landing.demo.card4.name")}</p>
              <p className="text-xs text-muted-fg">{t(lang, "landing.demo.card4.desc")}</p>
            </figcaption>
          </figure>
        </div>

        {/* Three-moment callout strip */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-center">
          <div>
            <p className="editorial-number text-[9px] tracking-[0.22em] text-accent mb-1">{t(lang, "landing.demo.rhythm.morning")}</p>
            <p className="text-sm text-muted-fg leading-snug">{t(lang, "landing.demo.rhythm.morningDesc")}</p>
          </div>
          <div>
            <p className="editorial-number text-[9px] tracking-[0.22em] text-accent mb-1">{t(lang, "landing.demo.rhythm.midday")}</p>
            <p className="text-sm text-muted-fg leading-snug">{t(lang, "landing.demo.rhythm.middayDesc")}</p>
          </div>
          <div>
            <p className="editorial-number text-[9px] tracking-[0.22em] text-accent mb-1">{t(lang, "landing.demo.rhythm.evening")}</p>
            <p className="text-sm text-muted-fg leading-snug">{t(lang, "landing.demo.rhythm.eveningDesc")}</p>
          </div>
        </div>
      </section>
    </>
  );
}
