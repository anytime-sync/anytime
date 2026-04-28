"use client";

import { useWeeklyRetro, useUserPrefs } from "@/hooks/use-ai";
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { getLanguage } from "@/lib/i18n";

export default function RetroPage() {
  const [target, setTarget] = useState<"last" | "current">("last");
  const { data, isLoading, isFetching, isError } = useWeeklyRetro(target);
  const { data: prefs } = useUserPrefs();
  const locale = getLanguage(prefs?.language).dateFnsLocale;
  // True when we have stale data on screen and a refetch is running —
  // typical case: user just switched language and the new translation
  // is being generated. Show a subtle 'Updating…' chip rather than
  // dropping back to a skeleton.
  const isRevalidating = !isLoading && isFetching;

  return (
    <div className="flex flex-col h-full">
      {/* Header bar — same shape as Today/Tomorrow/Eisenhower so this
          page sits in the same left-aligned column as the rest. */}
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="editorial-number text-xs mb-1">Weekly review</p>
            <h1 className="font-display text-2xl md:text-4xl tracking-tight leading-tight truncate">
              {target === "last" ? "Last week's edition" : "This week, so far"}
            </h1>
            {isRevalidating && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-fg">
                <Loader2 className="size-3 animate-spin" />
                Updating…
              </div>
            )}
          </div>
          <div className="inline-flex rounded-md border border-border overflow-hidden text-[11px] md:text-xs shrink-0">
            {(["last", "current"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTarget(t)}
                className={cn(
                  "px-2 md:px-3 h-7 whitespace-nowrap",
                  target === t ? "bg-fg text-bg" : "btn-ghost rounded-none"
                )}
              >
                {t === "last" ? "Last week" : "This week"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content — left-aligned, with a max-width on the article itself
          so editorial copy stays at readable measure (~70 chars). */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-3xl">
          {isLoading && (
            <div className="space-y-6 animate-pulse">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-20 w-full bg-muted rounded" />
              <div className="h-20 w-full bg-muted rounded" />
              <div className="h-12 w-full bg-muted rounded" />
            </div>
          )}

          {!isLoading && (isError || !data) && (
            <p className="text-sm text-muted-fg">
              AI features aren&apos;t enabled on this server, or no data yet for this week.
            </p>
          )}

          {data && (
            <article className="space-y-7">
              {data.week_start && (
                <p className="text-xs text-muted-fg">
                  Week of {format(new Date(data.week_start), "EEEE, MMMM d, yyyy", { locale })}
                </p>
              )}
              <Section kicker="Shipped" body={data.shipped} />
              <Section kicker="Slipped" body={data.slipped} />
              {/* Themes + next-week plan are the smarter-retro additions.
                  Both live in raw_json so older cached weeks won't have
                  them, and that's fine — Section no-ops on empty body. */}
              {(data.raw_json as any)?.themes && (
                <Section kicker="Themes" body={(data.raw_json as any).themes} />
              )}
              <Section kicker="Worth dropping" body={data.drop_list} variant="muted" />
              {(data.raw_json as any)?.next_week_plan && (
                <Section
                  kicker="For next week"
                  body={(data.raw_json as any).next_week_plan}
                  variant="accent"
                />
              )}
            </article>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  kicker,
  body,
  variant = "default",
}: {
  kicker: string;
  body: string;
  variant?: "default" | "muted" | "accent";
}) {
  if (!body) return null;
  return (
    <section
      className={cn(
        variant === "accent" &&
          "border-l-2 border-accent/60 pl-4 -ml-4 md:ml-0 md:pl-5"
      )}
    >
      <p
        className={cn(
          "editorial-number text-[11px] mb-2",
          variant === "accent" && "text-accent"
        )}
      >
        {kicker}
      </p>
      <p
        className={cn(
          "leading-relaxed",
          variant === "muted" && "text-sm text-muted-fg italic",
          variant === "default" && "text-[15px]",
          variant === "accent" && "text-[15px]"
        )}
      >
        {body}
      </p>
    </section>
  );
}
