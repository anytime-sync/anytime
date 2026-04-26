"use client";

import { useDailyEdition, useRegenerateEdition } from "@/hooks/use-ai";
import { RefreshCw, Newspaper } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * The Daily Edition card — the editorial AI briefing that anchors the
 * Today view. Cached server-side per (user, local date), so this is cheap
 * to mount and re-mounts hit the cache; the regenerate button forces a
 * fresh edition.
 *
 * If AI is disabled (no ANTHROPIC_API_KEY on the server), the hook returns
 * null and we render nothing — the page degrades to its pre-AI state.
 */
export function DailyEdition() {
  const { data, isLoading, isError } = useDailyEdition();
  const regen = useRegenerateEdition();

  if (isLoading) {
    return (
      <article className="rounded-xl border border-border bg-panel p-5 mb-6 animate-pulse">
        <div className="h-3 w-24 bg-muted rounded mb-3" />
        <div className="h-7 w-3/4 bg-muted rounded mb-3" />
        <div className="h-3 w-full bg-muted rounded mb-2" />
        <div className="h-3 w-11/12 bg-muted rounded" />
      </article>
    );
  }

  if (isError) {
    return (
      <article className="rounded-xl border border-border bg-panel p-4 mb-6 text-sm text-muted-fg">
        <p>Daily Edition couldn&apos;t load. <button className="underline hover:text-fg" onClick={() => regen.mutate()}>Try again</button></p>
      </article>
    );
  }
  if (!data) return null;

  return (
    <article className="rounded-xl border border-border bg-panel p-5 mb-6 group">
      <header className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <Newspaper className="size-3.5 text-muted-fg translate-y-0.5" />
          <span className="editorial-number text-xs">{data.kicker}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-fg">
          <span>{format(new Date(data.edition_date), "EEEE, MMMM d")}</span>
          <button
            className={cn(
              "size-6 rounded-full grid place-items-center transition",
              "opacity-0 group-hover:opacity-100",
              "hover:bg-muted",
              regen.isPending && "opacity-100 animate-spin"
            )}
            onClick={() => regen.mutate()}
            title="Regenerate edition"
            aria-label="Regenerate today's edition"
          >
            <RefreshCw className="size-3" />
          </button>
        </div>
      </header>
      <h1 className="font-display text-2xl md:text-3xl leading-tight tracking-tight mb-4">
        {data.headline}
      </h1>
      <div className="prose prose-sm max-w-none text-fg/90">
        <p className="text-[15px] leading-relaxed mb-3">
          {data.front_page}
        </p>
        <p className="text-[14px] leading-relaxed text-fg/80 mb-3">{data.inside}</p>
        <p className="text-[12px] italic text-muted-fg border-t border-border pt-3 mt-2">
          {data.below_fold}
        </p>
      </div>
    </article>
  );
}
