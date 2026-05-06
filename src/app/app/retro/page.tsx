"use client";

import { useWeeklyRetro, useUserPrefs } from "@/hooks/use-ai";
import { useTasks } from "@/hooks/use-tasks";
import { useMemo, useState } from "react";
import {
  addDays,
  addWeeks,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "date-fns";
import type { Locale } from "date-fns";
import { cn } from "@/lib/utils";
import { Clock, Loader2 } from "lucide-react";
import { ProcrastinationPanel } from "@/components/app/procrastination-panel";
import { getLanguage } from "@/lib/i18n";
import type { Task } from "@/lib/db.types";

type RetroTarget = "last" | "current" | "next";

export default function RetroPage() {
  const [target, setTarget] = useState<RetroTarget>("current");
  const { data, isLoading, isFetching, isError } = useWeeklyRetro(
    // The AI retro hook only knows "last" and "current". For "next" we
    // re-use the current-week summary (it's a forward-looking summary
    // anyway — themes / next_week_plan).
    target === "next" ? "current" : target
  );
  const { data: prefs } = useUserPrefs();
  const locale = getLanguage(prefs?.language).dateFnsLocale;

  // Pull every task (including completed) so the Scheduled section can show
  // both already-shipped and upcoming items in the visible week.
  const { data: allTasks = [] } = useTasks({
    view: "all",
    includeCompleted: true,
  });

  // True when we have stale data on screen and a refetch is running —
  // typical case: user just switched language and the new translation
  // is being generated. Show a subtle 'Updating…' chip rather than
  // dropping back to a skeleton.
  const isRevalidating = !isLoading && isFetching;

  // The Mon–Sun window we're viewing. "Last" = previous Mon, "Current" =
  // this Mon, "Next" = next Mon.
  const weekRange = useMemo(() => {
    const today = new Date();
    const thisMon = startOfWeek(today, { weekStartsOn: 1 });
    let start: Date;
    if (target === "last") start = addWeeks(thisMon, -1);
    else if (target === "next") start = addWeeks(thisMon, 1);
    else start = thisMon;
    return { start, end: addDays(start, 6) };
  }, [target]);

  // Group all in-range tasks by yyyy-MM-dd, sorted by start_at (then due_at).
  // We use start_at when present so timed events line up chronologically;
  // otherwise we fall back to due_at.
  const tasksByDay = useMemo(() => {
    const start = startOfDay(weekRange.start);
    const end = startOfDay(addDays(weekRange.end, 1)); // exclusive
    const groups: Record<string, Task[]> = {};
    let total = 0;
    for (const task of allTasks) {
      const anchor = task.start_at ?? task.due_at;
      if (!anchor) continue;
      const dt = new Date(anchor);
      if (dt < start || dt >= end) continue;
      const key = format(dt, "yyyy-MM-dd");
      (groups[key] ??= []).push(task);
      total += 1;
    }
    for (const k of Object.keys(groups)) {
      groups[k].sort((a, b) => {
        const aa = a.start_at ?? a.due_at ?? "";
        const bb = b.start_at ?? b.due_at ?? "";
        return aa.localeCompare(bb);
      });
    }
    return { groups, total };
  }, [allTasks, weekRange]);

  return (
    <div className="flex flex-col h-full">
      {/* Header bar — same shape as Today/Tomorrow/Eisenhower so this
          page sits in the same left-aligned column as the rest. */}
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="editorial-number text-xs mb-1">Weekly review</p>
            <h1 className="font-display text-2xl md:text-4xl tracking-tight leading-tight truncate">
              {target === "last"
                ? "Last week's edition"
                : target === "next"
                  ? "Next week, planned"
                  : "This week, so far"}
            </h1>
            {isRevalidating && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-fg">
                <Loader2 className="size-3 animate-spin" />
                Updating…
              </div>
            )}
          </div>
          <div className="inline-flex rounded-md border border-border overflow-hidden text-[11px] md:text-xs shrink-0">
            {(["last", "current", "next"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTarget(t)}
                className={cn(
                  "px-2 md:px-3 h-7 whitespace-nowrap",
                  target === t ? "bg-fg text-bg" : "btn-ghost rounded-none"
                )}
              >
                {t === "last"
                  ? "Last week"
                  : t === "next"
                    ? "Next week"
                    : "This week"}
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

          {!isLoading && (isError || !data) && tasksByDay.total === 0 && (
            <p className="text-sm text-muted-fg">
              AI features aren&apos;t enabled on this server, or no data yet for this week.
            </p>
          )}

          {(data || tasksByDay.total > 0) && (
            <article className="space-y-7">
              <p className="text-xs text-muted-fg">
                Week of{" "}
                {format(weekRange.start, "EEEE, MMMM d, yyyy", { locale })}
              </p>

              {/* The Scheduled section is the actual source of truth —
                  it lists every timed/all-day task in the visible week so
                  the user can see exactly what's on the calendar. We
                  render it before the AI narrative so meetings / events
                  are the headline, not buried below themes. */}
              {tasksByDay.total > 0 && (
                <ScheduledSection
                  tasksByDay={tasksByDay.groups}
                  weekStart={weekRange.start}
                  total={tasksByDay.total}
                  locale={locale}
                  target={target}
                />
              )}

              {data?.shipped && <Section kicker="Shipped" body={data.shipped} />}
              {data?.slipped && <Section kicker="Slipped" body={data.slipped} />}
              {/* Themes + next-week plan are the smarter-retro additions.
                  Both live in raw_json so we don't need a schema migration;
                  older cached weeks won't have them, and that's fine — the
                  Section component just no-ops when the body is empty. */}
              {(data?.raw_json as any)?.themes && (
                <Section
                  kicker="Themes"
                  body={(data!.raw_json as any).themes}
                />
              )}
              {data?.drop_list && (
                <Section
                  kicker="Worth dropping"
                  body={data.drop_list}
                  variant="muted"
                />
              )}
              {(data?.raw_json as any)?.next_week_plan && (
                <Section
                  kicker="For next week"
                  body={(data!.raw_json as any).next_week_plan}
                  variant="accent"
                />
              )}
            </article>
          )}
          <div className="mt-10">
            <ProcrastinationPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Scheduled section — day-by-day task list for the visible week.
// ---------------------------------------------------------------------
function ScheduledSection({
  tasksByDay,
  weekStart,
  total,
  locale,
  target,
}: {
  tasksByDay: Record<string, Task[]>;
  weekStart: Date;
  total: number;
  locale: Locale;
  target: RetroTarget;
}) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  // Only render days that actually have items — keeps the section dense
  // when most of the week is empty.
  const populated = days.filter(
    (d) => (tasksByDay[format(d, "yyyy-MM-dd")] ?? []).length > 0
  );
  if (populated.length === 0) return null;

  const kicker =
    target === "current"
      ? `On the calendar · ${total} item${total === 1 ? "" : "s"}`
      : `Scheduled · ${total} item${total === 1 ? "" : "s"}`;

  return (
    <section>
      <p className="editorial-number text-[11px] mb-3">{kicker}</p>
      <div className="space-y-3">
        {populated.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const items = tasksByDay[key] ?? [];
          const isToday = isSameDay(day, today);
          return (
            <div
              key={key}
              className="flex items-start gap-4 border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
            >
              <div className="w-20 shrink-0">
                <div
                  className={cn(
                    "text-[11px] uppercase tracking-wide",
                    isToday ? "text-accent" : "text-muted-fg"
                  )}
                >
                  {format(day, "EEE", { locale })}
                </div>
                <div
                  className={cn(
                    "font-display text-lg leading-none mt-0.5",
                    isToday && "text-accent"
                  )}
                >
                  {format(day, "MMM d", { locale })}
                </div>
              </div>
              <ul className="flex-1 space-y-1.5 min-w-0">
                {items.map((t) => (
                  <ScheduledRow key={t.id} task={t} locale={locale} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ScheduledRow({ task, locale }: { task: Task; locale: Locale }) {
  const anchor = task.start_at ?? task.due_at;
  const time = anchor && !task.is_all_day
    ? format(new Date(anchor), "h:mm a", { locale })
    : "All day";
  return (
    <li className="flex items-start gap-2 text-[14px] leading-snug">
      <span
        className={cn(
          "inline-flex items-center gap-1 shrink-0 text-[11px] tabular-nums",
          "text-muted-fg pt-[2px] w-[78px]"
        )}
      >
        <Clock className="size-3" /> {time}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1",
          task.is_completed && "line-through text-muted-fg"
        )}
      >
        {task.title}
      </span>
    </li>
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
