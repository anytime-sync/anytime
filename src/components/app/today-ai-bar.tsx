"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Sparkles, Check, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { isPast, isToday, endOfDay, differenceInCalendarDays } from "date-fns";
import { useTasks, useUpdateTask, type TaskWithTags } from "@/hooks/use-tasks";
import { useRescheduleTasks, type RescheduleSuggestion } from "@/hooks/use-ai";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { t as tr } from "@/lib/i18n";

/**
 * Two AI-flavoured affordances on /app/today:
 *
 *   1. WORKLOAD HEADER — sums today's estimated minutes vs. a heuristic
 *      free-time budget (8 hours minus already-time-blocked tasks). When
 *      the user is "over", the chip turns warning-coloured.
 *
 *   2. RESCHEDULE OVERDUE — opens a modal that batch-asks the AI to
 *      either reschedule, defer, or drop each overdue task. Apply
 *      individually or all at once.
 */
export function TodayAiBar() {
  const lang = useLanguage();
  const { data: tasks = [] } = useTasks({});
  const update = useUpdateTask();
  const reschedule = useRescheduleTasks();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<RescheduleSuggestion[] | null>(null);

  // Workload calc: sum estimated_minutes for tasks due today (or pinned to
  // today). Compare to ~8 hours minus blocks already in the calendar.
  const workload = useMemo(() => {
    const eod = endOfDay(new Date());
    const today = tasks.filter((t) => {
      if (t.is_completed) return false;
      if (!t.due_at) return false;
      const d = new Date(t.due_at);
      return isToday(d) || (d <= eod && !isPast(d) && !t.start_at);
    });
    const planned = today.reduce(
      (acc, t) => acc + ((t as any).estimated_minutes ?? 0),
      0
    );
    // Already-blocked time (start_at..due_at on time-blocked tasks today)
    const bookedMs = today.reduce((acc, t) => {
      if (!t.start_at || !t.due_at) return acc;
      return acc + Math.max(0, new Date(t.due_at).getTime() - new Date(t.start_at).getTime());
    }, 0);
    const bookedMin = Math.round(bookedMs / 60_000);
    const FREE_MIN_BUDGET = 8 * 60; // ~8 hours of working time per day
    const free = Math.max(0, FREE_MIN_BUDGET - bookedMin);
    return {
      planned,
      free,
      delta: planned - free,
      hasEstimates: today.some((t) => (t as any).estimated_minutes != null),
    };
  }, [tasks]);

  // Overdue slice — open, due_at in the past (not just today).
  const overdue = useMemo(() => {
    return tasks
      .filter((t) => !t.is_completed)
      .filter((t) => t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at)))
      .slice(0, 30);
  }, [tasks]);

  async function runReschedule() {
    if (overdue.length === 0) {
      toast.message(tr(lang, "todayAi.toastNothingOverdue"));
      return;
    }
    setOpen(true);
    setResults(null);
    try {
      const r = await reschedule.mutateAsync({
        tasks: overdue.map((t) => ({
          id: t.id,
          title: t.title,
          due_at: t.due_at,
          priority: t.priority,
          days_overdue: Math.max(0, differenceInCalendarDays(new Date(), new Date(t.due_at!))),
        })),
      });
      if (!r) {
        toast.error(tr(lang, "common.aiDisabled"));
        setOpen(false);
        return;
      }
      setResults(r.suggestions);
    } catch (e: any) {
      toast.error(
        e?.message?.includes("429")
          ? tr(lang, "todayAi.errBudget")
          : tr(lang, "todayAi.errReschedule")
      );
      setOpen(false);
    }
  }

  function apply(s: RescheduleSuggestion) {
    if (s.verdict === "drop") {
      // Drop = clear the due date but keep the task. (Soft delete is too aggressive.)
      update.mutate({ id: s.id, due_at: null } as any);
    } else {
      update.mutate({ id: s.id, due_at: s.new_due_at } as any);
    }
    setResults((r) => (r ? r.filter((x) => x.id !== s.id) : null));
  }

  function applyAll() {
    if (!results) return;
    const n = results.length;
    for (const s of results) apply(s);
    toast.success(tr(lang, "planDay.toastApplied").replace("{n}", String(n)));
    setOpen(false);
    setResults(null);
  }

  return (
    <>
      {workload.hasEstimates && (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs",
            workload.delta > 30
              ? "border-warning text-warning bg-warning/10"
              : "border-border text-muted-fg"
          )}
          title={`Today: ~${workload.planned}m of work · ~${workload.free}m of free time`}
        >
          <Sparkles className="size-3.5" />
          {workload.delta > 30
            ? `${minutes(workload.delta)} ${tr(lang, "todayAi.over")}`
            : `${minutes(workload.planned)} ${tr(lang, "todayAi.planned")}`}
        </span>
      )}

      {overdue.length > 0 && (
        <button
          onClick={runReschedule}
          disabled={reschedule.isPending}
          className="btn-ghost h-9 px-3 text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
          title={`AI reschedules ${overdue.length} overdue task${overdue.length !== 1 ? "s" : ""}`}
        >
          <CalendarClock
            className={cn("size-3.5", reschedule.isPending && "animate-spin")}
          />
          {reschedule.isPending
            ? tr(lang, "todayAi.rescheduling")
            : tr(lang, "todayAi.clearOverdue").replace("{n}", String(overdue.length))}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="card max-w-xl w-[92vw] p-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-xl">{tr(lang, "todayAi.modalTitle")}</h2>
              {results && (
                <span className="text-xs text-muted-fg">
                  {results.length} item{results.length !== 1 && "s"}
                </span>
              )}
            </div>

            {!results && (
              <p className="text-sm text-muted-fg">{tr(lang, "todayAi.reading")}</p>
            )}

            {results && results.length > 0 && (
              <ul className="space-y-2">
                {results.map((s) => {
                  const t = overdue.find((x) => x.id === s.id);
                  if (!t) return null;
                  return (
                    <li
                      key={s.id}
                      className="border border-border rounded-md p-3 flex items-start gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{t.title}</div>
                        <div className="text-xs text-muted-fg mt-0.5">
                          <span className={cn(
                            "uppercase tracking-wider text-[10px] mr-1",
                            s.verdict === "drop" ? "text-warning" : "text-fg"
                          )}>
                            {s.verdict === "drop" ? tr(lang, "procrastination.verdictDrop") : s.verdict}
                          </span>
                          {s.new_due_at &&
                            `→ ${new Date(s.new_due_at).toLocaleString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })} · `}
                          {s.reason}
                        </div>
                      </div>
                      <button
                        className="btn-ghost size-8 grid place-items-center text-success"
                        title={tr(lang, "common.apply")}
                        onClick={() => apply(s)}
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        className="btn-ghost size-8 grid place-items-center text-muted-fg"
                        title={tr(lang, "common.skip")}
                        onClick={() =>
                          setResults((r) => (r ? r.filter((x) => x.id !== s.id) : null))
                        }
                      >
                        <XIcon className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {results && results.length === 0 && (
              <p className="text-sm text-muted-fg">{tr(lang, "todayAi.cleared")}</p>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                className="btn-ghost h-8 px-3 text-xs"
                onClick={() => {
                  setOpen(false);
                  setResults(null);
                }}
              >
                {tr(lang, "todayAi.close")}
              </button>
              {results && results.length > 0 && (
                <button
                  className="btn-primary h-8 px-3 text-xs"
                  onClick={applyAll}
                >
                  {tr(lang, "todayAi.applyAll")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function minutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}h` : `${h}h${mm}m`;
}
