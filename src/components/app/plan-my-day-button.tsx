"use client";

import { useState } from "react";
import { Sparkles, Check, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { isToday, isPast, endOfDay } from "date-fns";
import { useTasks, useUpdateTask, type TaskWithTags } from "@/hooks/use-tasks";
import { usePlanDay, type PlanWeekSuggestion } from "@/hooks/use-ai";
import { cn } from "@/lib/utils";

/**
 * Plan-my-day — the morning ritual companion to Plan-my-week.
 *
 * Sends every task that's due today, overdue, or undated open to the
 * AI in one batch. The model returns a quadrant + suggested priority +
 * 6-12 word reason for each. User can apply individually or "Apply all"
 * to commit the new priorities + due_at changes.
 */
export function PlanMyDayButton() {
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
      toast.message("Nothing on the plate today.");
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
        toast.error("AI is currently disabled.");
        setOpen(false);
        return;
      }
      setResults(r.suggestions);
      setNotes(r.notes);
    } catch (e: any) {
      toast.error(
        e?.message?.includes("429")
          ? "Daily plan-day budget reached. Try again tomorrow."
          : "Couldn't plan your day — try again."
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
    toast.success(
      `Applied ${results.length} suggestion${results.length !== 1 ? "s" : ""}.`
    );
    setOpen(false);
    setResults(null);
  }

  return (
    <>
      <button
        onClick={run}
        disabled={running}
        className="btn-primary gap-2 h-9 px-3 text-xs disabled:opacity-50"
        title="AI plans today as a coherent whole"
      >
        <Sparkles className={cn("size-3.5", running && "animate-spin")} />
        {running ? "Planning…" : "Plan my day"}
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
              <h2 className="font-display text-xl">Today</h2>
              {results && (
                <span className="text-xs text-muted-fg">
                  {results.length} item{results.length !== 1 && "s"}
                </span>
              )}
            </div>

            {running && (
              <p className="text-sm text-muted-fg">Reading the day…</p>
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
                  return (
                    <li
                      key={s.id}
                      className="border border-border rounded-md p-3 flex items-start gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {t.title}
                        </div>
                        <div className="text-xs text-muted-fg mt-0.5">
                          <span className="text-fg">Q{s.quadrant}</span> · p
                          {s.suggested_priority} · {s.reason}
                        </div>
                      </div>
                      <button
                        className="btn-ghost size-8 grid place-items-center text-success"
                        title="Apply"
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
                        title="Skip"
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
                Nothing left — your day is set.
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
                Close
              </button>
              {results && results.length > 0 && (
                <button
                  className="btn-primary h-8 px-3 text-xs"
                  onClick={applyAll}
                >
                  Apply all
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
