"use client";

import { useEffect, useState } from "react";
import { useDailyEdition, useRegenerateEdition, useUserPrefs } from "@/hooks/use-ai";
import { RefreshCw, Newspaper, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { getLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";
import { useCanUseFeature } from "@/hooks/use-feature-access";

/**
 * The Daily Edition card — editorial AI briefing on the Today view.
 *
 * Mobile vs. desktop:
 *   - Always shown: kicker, date, headline, front_page (the lead).
 *   - Below md breakpoint: 'inside' and 'below_fold' are hidden behind
 *     a "Read more" toggle so the card stays scannable on phones.
 *   - md+ : everything is visible by default.
 *
 * Padding and headline size also scale down on mobile.
 */
export function DailyEdition() {
  const aiEnabled = useCanUseFeature("ai_daily_edition");
  const lang = useLanguage();
  const { data, isLoading, isError, error } = useDailyEdition();
  const regen = useRegenerateEdition();
  const { data: prefs } = useUserPrefs();
  const locale = getLanguage(prefs?.language).dateFnsLocale;
  const [expanded, setExpanded] = useState(false);

  // Auto-expand on md+ screens. Recompute on resize.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setExpanded(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (isLoading) {
    return (
      <article className="rounded-xl border border-border surface p-4 md:p-5 mb-6 animate-pulse">
        <div className="h-3 w-24 bg-muted rounded mb-3" />
        <div className="h-7 w-3/4 bg-muted rounded mb-3" />
        <div className="h-3 w-full bg-muted rounded mb-2" />
        <div className="h-3 w-11/12 bg-muted rounded" />
      </article>
    );
  }

  if (isError) {
    const code = (error as Error & { code?: string } | null)?.code;
    if (code === "rate_limited") {
      return (
        <article className="rounded-xl border border-border surface p-4 mb-6 text-sm text-muted-fg">
          <p>{t(lang, "dailyEdition.rateLimited")}</p>
        </article>
      );
    }
    return (
      <article className="rounded-xl border border-border surface p-4 mb-6 text-sm text-muted-fg">
        <p>
          {t(lang, "dailyEdition.errLoad")}{" "}
          <button className="underline hover:text-fg" onClick={() => regen.mutate()}>
            {t(lang, "dailyEdition.tryAgain")}
          </button>
        </p>
      </article>
    );
  }
  if (!data) return null;

  if (!aiEnabled) return null;
  return (
    <article className="rounded-xl border border-border surface p-4 md:p-5 mb-6 group">
      <header className="flex items-baseline justify-between gap-3 mb-2.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <Newspaper className="size-3.5 text-muted-fg translate-y-0.5 shrink-0" />
          <span className="editorial-number text-[10px] md:text-xs truncate">
            {data.kicker}
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-3 text-[11px] text-muted-fg shrink-0">
          <span className="hidden sm:inline">
            {format(new Date(data.edition_date), "EEEE, MMMM d", { locale })}
          </span>
          <span className="sm:hidden">
            {format(new Date(data.edition_date), "MMM d", { locale })}
          </span>
          <button
            className={cn(
              "size-6 rounded-full grid place-items-center transition",
              "opacity-60 md:opacity-0 md:group-hover:opacity-100",
              "hover:bg-muted",
              regen.isPending && "opacity-100 animate-spin"
            )}
            onClick={() => regen.mutate()}
            title={t(lang, "dailyEdition.regenerate")}
            aria-label={t(lang, "dailyEdition.regenAria")}
          >
            <RefreshCw className="size-3" />
          </button>
        </div>
      </header>

      <h1 className="font-display text-lg md:text-3xl leading-tight tracking-tight mb-2 md:mb-3">
        {data.headline}
      </h1>

      {/* Mobile: only the headline shows by default. Read more reveals
          front_page + inside + below_fold. Desktop: everything visible. */}
      {expanded ? (
        <>
          <p className="text-[14px] md:text-[15px] leading-relaxed text-fg/90 mb-3">
            {data.front_page}
          </p>
          <p className="text-[13px] md:text-[14px] leading-relaxed text-fg/80 mb-3">
            {data.inside}
          </p>
          <p className="text-[12px] italic text-muted-fg border-t border-border pt-3 mt-2">
            {data.below_fold}
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="md:hidden inline-flex items-center gap-1 text-xs text-muted-fg hover:text-fg transition-colors"
        >
          {t(lang, "dailyEdition.readMore")}
          <ChevronDown className="size-3.5" />
        </button>
      )}
    </article>
  );
}
