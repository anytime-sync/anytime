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
import { useCanUseFeature } from "@/hooks/use-feature-access";

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
  // Tier/flag gate for the AI reschedule affordance. When the feature is off
  // for this user's plan (or admin-disabled), we simply don't render the
  // button — no dangling control that would only error on click.
  const canReschedule = useCanUseFeature("ai_reschedule_task");
  // If an entitled user exhausts their AI budget, hide the button for the
  // rest of the session instead of surfacing a "cap reached" error.
  const [capped, setCapped] = useState(false);
  const [applying, setApplying] = useState(false);
  const [coverage, setCoverage] = useState('');
  const [unplaced, setUnplaced] = useState(0);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<RescheduleSuggestion[] | null>(null);

  // Estimates describe task effort; calendar availability is calculated separately.
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
    return {
      planned,
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
          estimated_minutes: (t as any).estimated_minutes ?? null,
          days_overdue: Math.max(0, differenceInCalendarDays(new Date(), new Date(t.due_at!))),
        })),
      });
      if (!r) {
        // Feature turned off underneath us — hide silently, don't alarm.
        setCapped(true);
        setOpen(false);
        return;
      }
      setResults(r.suggestions); setCoverage(r.coverage ?? ""); setUnplaced(r.unplaced ?? 0);
    } catch (e: any) {
      // 429 = AI budget/cap exhausted. Per product rule, don't dangle a
      // feature the user can't currently use: hide the button instead of
      // showing a cap error. Any other error is a genuine failure worth a
      // brief, non-blocking notice.
      if (e?.message?.includes("429")) {
        setCapped(true);
      } else {
        toast.error(tr(lang, "todayAi.errReschedule"));
      }
      setOpen(false);
    }
  }

  async function saveSuggestion(s: RescheduleSuggestion) {
    if (!s.start_at || !s.due_at || Date.parse(s.start_at) >= Date.parse(s.due_at) || Date.parse(s.start_at) < Date.now()) {
      toast.error('This suggestion is no longer valid. Find new slots.'); return false;
    }
    try {
      await update.mutateAsync({ id:s.id, start_at:s.start_at, due_at:s.due_at, is_all_day:false });
      setResults(r => r ? r.filter(x=>x.id!==s.id) : null); return true;
    } catch { toast.error('Could not save this move. The suggestion remains for review.'); return false; }
  }
  async function apply(s:RescheduleSuggestion) {
    if(applying)return; setApplying(true);
    try { await saveSuggestion(s); } finally { setApplying(false); }
  }
  async function applyAll() {
    if(!results || applying)return; setApplying(true); let saved=0;
    try { for(const s of results) if(await saveSuggestion(s))saved++; }
    finally { setApplying(false); }
    if(saved)toast.success(String(saved)+' task moves saved.');
  }

  return (
    <>
      {workload.hasEstimates && (
        <span
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs border-border text-muted-fg"
          title="Estimated effort for tasks due today. Tasks without estimates and calendar availability are not included."
        >
          <Sparkles className="size-3.5" />
          {`${minutes(workload.planned)} ${tr(lang, "todayAi.planned")}`}
        </span>
      )}

      {overdue.length > 0 && canReschedule && !capped && (
        <button
          onClick={runReschedule}
          disabled={reschedule.isPending}
          className="btn-ghost h-9 px-3 text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
          title="Review calculated slots for overdue tasks"
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
              <h2 className="font-display text-xl">Review proposed task moves</h2>
              {results && (
                <span className="text-xs text-muted-fg">
                  {results.length} item{results.length !== 1 && "s"}
                </span>
              )}
            </div>

            {coverage && <p className="text-xs text-muted-fg mb-3">{coverage}</p>}
            {unplaced > 0 && <p className="text-sm text-warning mb-3">{unplaced} tasks have no fitting slot. Their dates remain unchanged.</p>}
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
                          {(s.start_at ?? s.new_due_at) &&
                            `→ ${new Date((s.start_at ?? s.new_due_at)!).toLocaleString(undefined, {
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
                        disabled={applying} onClick={() => void apply(s)}
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
              <p className="text-sm text-muted-fg">No remaining suggestions in this review. Unplaced or skipped tasks keep their dates.</p>
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
                  disabled={applying} onClick={() => void applyAll()}
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
