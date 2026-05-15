"use client";

import { useState } from "react";
import { Sparkles, Check, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isPast, endOfDay } from "date-fns";
import { useTasks, useUpdateTask, type TaskWithTags } from "@/hooks/use-tasks";
import { usePlanDay, type PlanWeekSuggestion } from "@/hooks/use-ai";
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
    due_at: string | null;
  } {
    const eod = endOfDay(new Date()).toISOString();
    switch (q) {
      case 1:
        return { priority: 5, due_at: eod };
      case 2:
        return { priority: 5, due_at: null };
      case 3:
        return { priority: 1, due_at: eod };
      case 4:
        return { priority: 0, due_at: null };
    }
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

            {results && results.length > 0 && (
              <ul className="space-y-2">
                {results.map((s) => {
                  const t = allTasks.find((x) => x.id === s.id);
                  if (!t) return null;
                const isUrgent = !!t.due_at && (() => { const d = new Date(t.due_at); return isPast(d) || isToday(d); })();
                const isImportant = (t.priority ?? 0) >= 3;
                const currentQ = isUrgent && isImportant ? 1 : !isUrgent && isImportant ? 2 : isUrgent && !isImportant ? 3 : 4;
                  return (
                    <li
                      key={s.id}
                      className="border border-border rounded-md p-3 flex items-start gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {t.title}
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
                            {t.due_at && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted/50 text-[11px] text-muted-fg leading-none">
                                {format(new Date(t.due_at), "MMM d, h:mm a")}
                              </span>
                            )}
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
            )}

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
