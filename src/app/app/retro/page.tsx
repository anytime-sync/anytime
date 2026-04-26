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
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <p className="editorial-number text-xs">Weekly review</p>
        <h1 className="font-display text-3xl md:text-4xl mt-1">
          {target === "last" ? "Last week's edition" : "This week, so far"}
        </h1>
        {isRevalidating && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-fg">
            <Loader2 className="size-3 animate-spin" />
            Updating…
          </div>
        )}
        <div className="mt-3 inline-flex rounded-md border border-border overflow-hidden text-xs">
          {(["last", "current"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={cn(
                "px-3 h-7",
                target === t ? "bg-fg text-bg" : "btn-ghost rounded-none"
              )}
            >
              {t === "last" ? "Last week" : "This week"}
            </button>
          ))}
        </div>
      </header>

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
          <Section kicker="Worth dropping" body={data.drop_list} variant="muted" />
        </article>
      )}
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
  variant?: "default" | "muted";
}) {
  return (
    <section>
      <p className="editorial-number text-[11px] mb-2">{kicker}</p>
      <p
        className={cn(
          "leading-relaxed",
          variant === "muted" ? "text-sm text-muted-fg italic" : "text-[15px]"
        )}
      >
        {body}
      </p>
    </section>
  );
}
