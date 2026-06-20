"use client";

import { useState } from "react";
import { Sparkles, Check, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isPast, endOfDay } from "date-fns";
import { useTasks, useUpdateTask, type TaskWithTags } from "@/hooks/use-tasks";
import { usePlanDay, type PlanWeekSuggestion } from "@/hooks/use-ai";
import { useCanUseFeature } from "@/hooks/use-feature-access";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { t as tr } from "@/lib/i18n";

/**
 * Plan-my-day — the morning ritual companion to Plan-my-week.
 *
 * Sends every task that's due today, overdue, or undated open to the
 * AI in one batch. The model returns a quadrant + suggested priority +
 * 6-12 word reason for each. User can apply individually or "Apply all"
 * to commit the new priorities + due_at changes.
 */
const Q_LABEL: Record<number, string> = {
  1: "Do first",
  2: "Schedule",
  3: "Delegate",
  4: "Eliminate",
};
const P_LABEL: Record<number, string> = {
  0: "None",
  1: "Low",
  3: "Medium",
  5: "High",
};

export function PlanMyDayButton() {
  const aiEnabled = useCanUseFeature("ai_plan_my_day");
  const lang = useLanguage();
  const { data: allTasks = [] } = useTasks({});
  const update = useUpdateTask();
  const planMutation = usePlanDay();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PlanWeekSuggestion[] | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [running, setRunning] = useState(false);

  // Today's slice: due today, overdue, or undated open.
  function pickHorizon(): TaskWithTags[] {
    const eod = endOfDay(new Date());
    return allTasks
      .filter((t) => !t.is_completed)
      .filter((t) => {
        if (!t.due_at) return true; // undated open work counts
        const d = new Date(t.due_at);
        return d <= eod || isToday(d) || isPast(d);
      })
      .slice(0, 40);
  }

  function targetForQuadrant(q: 1 | 2 | 3 | 4): {
    priority: 0 | 1 | 3 | 5;
    start_at: string | null;
    due_at: string | null;
  } {
    const today9 = new Date(); today9.setHours(9, 0, 0, 0);
    const today930 = new Date(); today930.setHours(9, 30, 0, 0);
    switch (q) {
      case 1: return { priority: 5, start_at: today9.toISOString(), due_at: today930.toISOString() };
      case 2: return { priority: 5, start_at: null, due_at: null };
      case 3: return { priority: 1, start_at: today9.toISOString(), due_at: today930.toISOString() };
      case 4: return { priority: 0, start_at: null, due_at: null };
    }
  }

  function fmtDate(iso: string | null | undefined): string {
    if (!iso) return "No date";
    const d = new Date(iso);
    // Show date only (no time) — the time is always 09:00 so it adds no info
    const today = new Date();
    const isToday2 = d.toDateString() === today.toDateString();
    if (isToday2) return "Today";
    const isThisYear = d.getFullYear() === today.getFullYear();
    return format(d, isThisYear ? "EEE MMM d" : "EEE MMM d yyyy");
  }

  function slotChip(task: { start_at?: string | null; due_at?: string | null }, q: 1 | 2 | 3 | 4) {
    const target = targetForQuadrant(q);
    // Use whichever slot field is set; prefer start_at
    const currentDate = task.start_at ?? task.due_at ?? null;
    const newDate = target.start_at ?? target.due_at ?? null;

    // Compare YYYY-MM-DD local strings to ignore time-of-day differences.
    // null = "No date" is itself a meaningful state, so a transition
    // to/from null must always be shown.
    const currentDay = currentDate ? format(new Date(currentDate), "yyyy-MM-dd") : null;
    const newDay = newDate ? format(new Date(newDate), "yyyy-MM-dd") : null;

    // No chip ONLY when the date genuinely doesn't change (incl. null===null).
    if (currentDay === newDay) return null;

    // Always show BOTH sides — "No date → Today", "Today → No date",
    // "Sat Jun 14 → Today" — so the user can evaluate the reschedule.
    const fromLabel = fmtDate(currentDate);
    const toLabel = fmtDate(newDate);

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-[11px] leading-none text-blue-700 dark:text-blue-300">
        <span className={cn("opacity-70", currentDate && "line-through opacity-60")}>{fromLabel}</span>
        <span className="opacity-50">→</span>
        <span className="font-medium">{toLabel}</span>
      </span>
    );
  }

  async function run() {
    const horizon = pickHorizon();
    if (horizon.length === 0) {
      toast.message(tr(lang, "planDay.empty"));
      return;
    }
    setRunning(true);
    setOpen(true);
    setResults(null);
    setNotes("");
    try {
      const r = await planMutation.mutateAsync(
        horizon.map((t) => ({
          id: t.id,
          title: t.title,
          due_at: t.due_at,
          priority: t.priority,
          project: null,
        }))
      );
      if (!r) {
        toast.error(tr(lang, "common.aiDisabled"));
        setOpen(false);
        return;
      }
      setResults(r.suggestions);
      setNotes(r.notes);
    } catch (e: any) {
      toast.error(
        e?.message?.includes("429")
          ? tr(lang, "planDay.errBudget")
          : tr(lang, "planDay.errPlan")
      );
      setOpen(false);
    } finally {
      setRunning(false);
    }
  }

  function apply(s: PlanWeekSuggestion) {
    const target = targetForQuadrant(s.quadrant);
    update.mutate({
      id: s.id,
      priority: s.suggested_priority,
      start_at: target.start_at,
      due_at: target.due_at,
    } as any);
  }

  function applyAll() {
    if (!results) return;
    for (const s of results) apply(s);
    toast.success(tr(lang, "planDay.toastApplied").replace("{n}", String(results.length)));
    setOpen(false);
    setResults(null);
  }

  if (!aiEnabled) return null;
  return (
    <>
      <button
        onClick={run}
        disabled={running}
        className="btn-primary gap-2 h-9 px-3 text-xs disabled:opacity-50"
        title={tr(lang, "planDay.button")}
      >
        <Sparkles className={cn("size-3.5", running && "animate-spin")} />
        {running ? tr(lang, "planDay.planning") : tr(lang, "planDay.button")}
      </button>

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
              <h2 className="font-display text-xl">{tr(lang, "planDay.title")}</h2>
              {results && (
                <span className="text-xs text-muted-fg">
                  {results.length} item{results.length !== 1 && "s"}
                </span>
              )}
            </div>

            {running && (
              <p className="text-sm text-muted-fg">{tr(lang, "planDay.reading")}</p>
            )}

            {results && notes && (
              <p className="text-sm text-fg italic mb-3 leading-relaxed">
                {notes}
              </p>
            )}

            {results && results.length > 0 && (() => {
              // ------------------------------------------------------------------
              // Conflict detection — true range overlap in ms, not string-key.
              // Stored timestamps are UTC; we must compare ms values, not format
              // to local HH:MM strings (that would be off by the UTC+8 offset).
              //
              // A suggestion is "conflicting" when its target [start,end] range
              // overlaps with:
              //   (a) another suggestion's target range (same quadrant = same
              //       slot; Q1 and Q3 both go to today 09:00-09:30, so any two
              //       timed suggestions always collide), OR
              //   (b) an existing task's [start_at, due_at] that is NOT itself
              //       in the suggestion set.
              // Q2/Q4 have null slots so they never conflict.
              // ------------------------------------------------------------------
              const suggestedIds = new Set(results.map((r) => r.id));

              // [startMs, endMs] for a task or suggestion target; null = no slot.
              const rangeOf = (startIso: string | null, endIso: string | null): [number, number] | null => {
                const s = startIso ? new Date(startIso).getTime() : null;
                const e = endIso   ? new Date(endIso).getTime()   : null;
                if (!s || !e || isNaN(s) || isNaN(e)) return null;
                return [Math.min(s, e), Math.max(s, e)];
              };

              const overlaps = (a: [number, number], b: [number, number]) =>
                a[0] < b[1] && b[0] < a[1];

              // Collect ranges of existing (non-suggested, incomplete) tasks.
              const existingRanges: [number, number][] = [];
              for (const task of allTasks) {
                if (suggestedIds.has(task.id) || task.is_completed) continue;
                const r = rangeOf(task.start_at ?? null, task.due_at ?? null);
                if (r) existingRanges.push(r);
              }

              // Compute each suggestion's target range.
              const suggestionRanges = results.map((s) => {
                const tgt = targetForQuadrant(s.quadrant);
                return { id: s.id, range: rangeOf(tgt.start_at, tgt.due_at) };
              });

              const conflictSet = new Set<string>();
              for (let i = 0; i < suggestionRanges.length; i++) {
                const { id, range } = suggestionRanges[i];
                if (!range) continue;
                // (a) overlaps another suggestion?
                for (let j = 0; j < suggestionRanges.length; j++) {
                  if (i === j) continue;
                  const other = suggestionRanges[j].range;
                  if (other && overlaps(range, other)) { conflictSet.add(id); break; }
                }
                // (b) overlaps an existing task?
                if (!conflictSet.has(id)) {
                  for (const er of existingRanges) {
                    if (overlaps(range, er)) { conflictSet.add(id); break; }
                  }
                }
              }

              return (
              <ul className="space-y-2">
                {results.map((s) => {
                  const t = allTasks.find((x) => x.id === s.id);
                  if (!t) return null;
                const isUrgent = !!t.due_at && (() => { const d = new Date(t.due_at); return isPast(d) || isToday(d); })();
                const isOverdue = !!t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at));
                const isImportant = (t.priority ?? 0) >= 3;
                const currentQ = isUrgent && isImportant ? 1 : !isUrgent && isImportant ? 2 : isUrgent && !isImportant ? 3 : 4;
                const hasConflict = conflictSet.has(s.id);
                  return (
                    <li
                      key={s.id}
                      className={cn(
                        "border rounded-md p-3 flex items-start gap-3",
                        isOverdue
                          ? "border-red-400/60 bg-red-500/5 dark:border-red-500/40 dark:bg-red-500/5"
                          : hasConflict
                          ? "border-amber-400/60 bg-amber-500/5 dark:border-amber-500/40 dark:bg-amber-500/5"
                          : "border-border"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{t.title}</span>
                          {isOverdue && (
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-red-500 dark:text-red-400">overdue</span>
                          )}
                          {hasConflict && (
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">overlap</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-fg mt-1.5 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {currentQ !== s.quadrant ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/35 border border-accent/70 text-[11px] leading-none">
                                <span className="text-[#8D6F2A]/80 line-through decoration-[#8D6F2A]/60">{Q_LABEL[currentQ] ?? `Q${currentQ}`}</span>
                                <span className="text-[#8D6F2A]">→</span>
                                <span className="text-[#5C4516] font-bold">{Q_LABEL[s.quadrant] ?? `Q${s.quadrant}`}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted/50 text-[11px] text-muted-fg leading-none">
                                {Q_LABEL[currentQ] ?? `Q${currentQ}`}
                              </span>
                            )}
                            {(t.priority ?? 0) !== s.suggested_priority ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/35 border border-accent/70 text-[11px] leading-none">
                                <span className="text-[#8D6F2A]/80 line-through decoration-[#8D6F2A]/60">{P_LABEL[t.priority ?? 0] ?? `p${t.priority ?? 0}`}</span>
                                <span className="text-[#8D6F2A]">→</span>
                                <span className="text-[#5C4516] font-bold">{P_LABEL[s.suggested_priority] ?? `p${s.suggested_priority}`}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted/50 text-[11px] text-muted-fg leading-none">
                                {P_LABEL[t.priority ?? 0] ?? `p${t.priority ?? 0}`}
                              </span>
                            )}
                            {slotChip(t as any, s.quadrant)}
                            {currentQ === s.quadrant && (t.priority ?? 0) === s.suggested_priority && (
                              <span className="text-muted-fg/50 italic text-[11px]">already on target</span>
                            )}
                          </div>
                          <div className="italic text-muted-fg">{s.reason}</div>
                        </div>
                      </div>
                      <button
                        className="btn-ghost size-8 grid place-items-center text-success"
                        title={tr(lang, "common.apply")}
                        onClick={() => {
                          apply(s);
                          setResults((r) =>
                            r ? r.filter((x) => x.id !== s.id) : null
                          );
                        }}
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        className="btn-ghost size-8 grid place-items-center text-muted-fg"
                        title={tr(lang, "common.skip")}
                        onClick={() =>
                          setResults((r) =>
                            r ? r.filter((x) => x.id !== s.id) : null
                          )
                        }
                      >
                        <XIcon className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              );
            })()}

            {results && results.length === 0 && !running && (
              <p className="text-sm text-muted-fg">
                {tr(lang, "planDay.allSet")}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                className="btn-ghost h-8 px-3 text-xs"
                onClick={() => {
                  setOpen(false);
                  setResults(null);
                }}
              >
                {tr(lang, "planDay.close")}
              </button>
              {results && results.length > 0 && (
                <button
                  className="btn-primary h-8 px-3 text-xs"
                  onClick={applyAll}
                >
                  {tr(lang, "planDay.applyAll")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
