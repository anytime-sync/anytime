"use client";

import { useTasks, useUpdateTask, type TaskWithTags } from "@/hooks/use-tasks";
import { useUserPrefs } from "@/hooks/use-ai";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { addDays } from "date-fns";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";

/**
 * Anti-overload banner — the calm-OS counterweight to AI auto-schedulers
 * that cram. When today's estimated load exceeds the user's daily capacity,
 * we surface it plainly and let the user defer the lowest-priority task to
 * tomorrow with a single click.
 *
 * Heuristic load:
 *   sum of estimated_minutes for today's incomplete tasks,
 *   defaulting any unestimated task to default_task_minutes (30).
 */
export function AntiOverloadBanner() {
  const lang = useLanguage();
  const { data: tasks = [] } = useTasks({ view: "today" });
  const { data: prefs } = useUserPrefs();
  const update = useUpdateTask();

  const cap = prefs?.daily_capacity_minutes ?? 240;
  const fallback = prefs?.default_task_minutes ?? 30;
  const incomplete = tasks.filter((t: TaskWithTags) => !t.is_completed);
  const total = incomplete.reduce(
    (s, t) => s + ((t as any).estimated_minutes ?? fallback),
    0
  );
  if (total <= cap) return null;

  const overBy = total - cap;
  // Pick the most deferrable task — lowest priority, latest due time.
  const sorted = [...incomplete].sort(
    (a, b) =>
      (a.priority ?? 0) - (b.priority ?? 0) ||
      (b.due_at ? +new Date(b.due_at) : 0) - (a.due_at ? +new Date(a.due_at) : 0)
  );
  const candidate = sorted[0];

  function defer() {
    if (!candidate) return;
    const next = candidate.due_at
      ? addDays(new Date(candidate.due_at), 1)
      : addDays(new Date(), 1);
    // Preserve duration: shift start_at by the same offset as due_at
    if (candidate.start_at && candidate.due_at) {
      const durationMs = new Date(candidate.due_at).getTime() - new Date(candidate.start_at).getTime();
      const newStart = new Date(next.getTime() - durationMs);
      update.mutate({
        id: candidate.id,
        start_at: newStart.toISOString(),
        due_at: next.toISOString(),
      } as any);
    } else {
      update.mutate({ id: candidate.id, due_at: next.toISOString() } as any);
    }
  }

  return (
    <aside className="rounded-xl border border-border bg-warning/10 p-4 mb-6 flex items-start gap-3">
      <AlertTriangle className="size-5 mt-0.5 shrink-0 text-warning" />
      <div className="flex-1">
        <div className="text-sm font-medium">{t(lang, "antiOverload.full")}</div>
        <div className="text-xs text-muted-fg mt-0.5">
          About {Math.round(total / 60)}h on the desk against your {Math.round(cap / 60)}h
          deep-work budget — over by ~{Math.round(overBy / 60)}h. What comes off?
        </div>
        {candidate && (
          <button
            onClick={defer}
            className="mt-2 inline-flex items-center gap-1.5 text-xs btn-outline px-2.5 h-7"
          >
            Move <span className="font-medium truncate max-w-[180px]">{candidate.title}</span>{" "}
            to tomorrow <ArrowRight className="size-3" />
          </button>
        )}
      </div>
    </aside>
  );
}
