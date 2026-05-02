"use client";

import { useWeeklyRetro, useUserPrefs } from "@/hooks/use-ai";
import { useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { getLanguage } from "@/lib/i18n";

type Target = "last" | "current" | "next";

export default function RetroPage() {
  const [target, setTarget] = useState<Target>("current");

  // "next" reads from the current-week review (which carries the
  // forward plan in raw_json.next_week_plan); the network query is
  // effectively the same fetch under either tab.
  const sourceTarget: "last" | "current" = target === "next" ? "current" : target;
  const { data, isLoading, isFetching, isError } = useWeeklyRetro(sourceTarget);
  const { data: prefs } = useUserPrefs();
  const locale = getLanguage(prefs?.language).dateFnsLocale;
  const isRevalidating = !isLoading && isFetching;

  const headline =
    target === "last"
      ? "Last week's edition"
      : target === "current"
      ? "This week, so far"
      : "Next week, planned";

  // Compute the date label for each tab.
  let weekLabel: string | null = null;
  if (data?.week_start) {
    if (target === "next") {
      const ns = addDays(startOfWeek(new Date(data.week_start), { weekStartsOn: 1 }), 7);
      weekLabel = "Week of " + format(ns, "EEEE, MMMM d, yyyy", { locale });
    } else {
      weekLabel = "Week of " + format(new Date(data.week_start), "EEEE, MMMM d, yyyy", { locale });
    }
  }

  const themes = (data?.raw_json as any)?.themes as string | undefined;
  const nextWeekPlan = (data?.raw_json as any)?.next_week_plan as string | undefined;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="editorial-number text-xs mb-1">Weekly review</p>
            <h1 className="font-display text-2xl md:text-4xl tracking-tight leading-tight truncate">
              {headline}
            </h1>
            {isRevalidating && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-fg">
                <Loader2 className="size-3 animate-spin" />
                Updating\u2026
              </div>
            )}
          </div>
          <div className="inline-flex rounded-md border border-border overflow-hidden text-[11px] md:text-xs shrink-0">
            {(["last", "current", "next"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTarget(tab)}
                className={cn(
                  "px-2 md:px-3 h-7 whitespace-nowrap",
                  target === tab ? "bg-fg text-bg" : "btn-ghost rounded-none"
                )}
              >
                {tab === "last"
                  ? "Last week"
                  : tab === "current"
                  ? "This week"
                  : "Next week"}
              </button>
            ))}
          </div>
        </div>
      </div>

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
              {weekLabel && (
                <p className="text-xs text-muted-fg">{weekLabel}</p>
              )}
              {/* Shipped / Slipped only meaningful for past or current
                  weeks. The Section component returns null on empty body,
                  so on the Next tab these naturally hide. */}
              <Section
                kicker="Shipped"
                body={target === "next" ? "" : data.shipped}
              />
              <Section
                kicker="Slipped"
                body={target === "next" ? "" : data.slipped}
              />
              <Section kicker="Themes" body={themes ?? ""} />
              <Section
                kicker="Worth dropping"
                body={data.drop_list}
                variant="muted"
              />
              {nextWeekPlan && (
                <Section
                  kicker="For next week"
                  body={nextWeekPlan}
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
