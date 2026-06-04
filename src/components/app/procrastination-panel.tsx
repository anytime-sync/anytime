"use client";

import { useState } from "react";
import { Sparkles, Check, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { addDays } from "date-fns";
import {
  useProcrastination,
  type ProcrastinationItem,
} from "@/hooks/use-ai";
import { useTasks, useUpdateTask, useCreateTask } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { t as tr } from "@/lib/i18n";

/**
 * Inline panel for the weekly review page. A button kicks off
 * /api/ai/procrastination, which returns 3-5 verdicts on stuck tasks.
 * "Apply" maps each verdict to the right action:
 *   - drop       → clear due_at + priority
 *   - schedule   → set due_at to next Mon
 *   - break-down → create child tasks under the parent
 */
export function ProcrastinationPanel() {
  const lang = useLanguage();
  const { data: tasks = [] } = useTasks({});
  const update = useUpdateTask();
  const create = useCreateTask();
  const procrastinate = useProcrastination();
  const [data, setData] = useState<{ items: ProcrastinationItem[]; summary: string } | null>(null);

  async function run() {
    setData(null);
    try {
      const r = await procrastinate.mutateAsync();
      if (!r) {
        toast.error(tr(lang, "common.aiDisabled"));
        return;
      }
      setData(r);
    } catch (e: any) {
      toast.error(
        e?.message?.includes("429")
          ? tr(lang, "procrastination.errBudget")
          : tr(lang, "procrastination.errScan")
      );
    }
  }

  function titleFor(id: string) {
    return tasks.find((t) => t.id === id)?.title ?? tr(lang, "common.unknown");
  }
  function projectFor(id: string) {
    return tasks.find((t) => t.id === id)?.project_id ?? null;
  }

  async function apply(it: ProcrastinationItem) {
    if (it.verdict === "drop") {
      update.mutate({ id: it.id, due_at: null, start_at: null, priority: 0 } as any);
    } else if (it.verdict === "schedule") {
      // Pin to next Monday at end of day.
      const now = new Date();
      const day = now.getDay() || 7;
      const daysUntilNextMon = day === 1 ? 7 : 8 - day;
      const next = addDays(now, daysUntilNextMon);
      next.setHours(23, 59, 0, 0);
      // Preserve duration: shift start_at by the same offset
      const task = tasks.find((t) => t.id === it.id);
      if (task?.start_at && task?.due_at) {
        const durationMs = new Date(task.due_at).getTime() - new Date(task.start_at).getTime();
        const newStart = new Date(next.getTime() - durationMs);
        update.mutate({ id: it.id, start_at: newStart.toISOString(), due_at: next.toISOString() } as any);
      } else {
        update.mutate({ id: it.id, due_at: next.toISOString() } as any);
      }
    } else if (it.verdict === "break-down") {
      const parent = tasks.find((t) => t.id === it.id);
      const project_id = projectFor(it.id);
      for (const sub of it.subtasks ?? []) {
        await create.mutateAsync({
          title: sub,
          parent_id: parent?.id,
          project_id,
        } as any);
      }
    }
    setData((d) => (d ? { ...d, items: d.items.filter((x) => x.id !== it.id) } : d));
  }

  return (
    <section className="border border-border rounded-lg p-4 surface">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h3 className="font-display text-xl">{tr(lang, "procrastination.title")}</h3>
          <p className="text-sm text-muted-fg italic leading-relaxed mt-0.5">
            {tr(lang, "procrastination.intro")}
          </p>
        </div>
        <button
          onClick={run}
          disabled={procrastinate.isPending}
          className="btn-ghost h-8 px-3 text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          <Sparkles
            className={cn("size-3.5", procrastinate.isPending && "animate-spin")}
          />
          {procrastinate.isPending ? tr(lang, "procrastination.scanning") : tr(lang, "procrastination.scan")}
        </button>
      </div>

      {data && data.summary && (
        <p className="text-base text-fg italic font-display mb-3 leading-relaxed">{data.summary}</p>
      )}

      {data && data.items.length > 0 && (
        <ul className="space-y-2">
          {data.items.map((it) => (
            <li
              key={it.id}
              className="border border-border rounded-md p-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-base truncate">{titleFor(it.id)}</div>
                  <div className="text-sm text-muted-fg mt-0.5 leading-relaxed">
                    <span className={cn(
                      "uppercase tracking-wider text-xs mr-1",
                      it.verdict === "drop"
                        ? "text-warning"
                        : it.verdict === "break-down"
                        ? "text-accent"
                        : "text-fg"
                    )}>
                      {it.verdict === "drop" ? tr(lang, "procrastination.verdictDrop") : it.verdict === "break-down" ? tr(lang, "procrastination.verdictBreak") : tr(lang, "procrastination.verdictSchedule")}
                    </span>
                    {it.reason}
                  </div>
                  {it.verdict === "break-down" && it.subtasks.length > 0 && (
                    <ul className="mt-2 ml-4 list-disc text-sm text-muted-fg space-y-0.5">
                      {it.subtasks.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  className="btn-ghost size-8 grid place-items-center text-success"
                  title={tr(lang, "procrastination.apply")}
                  onClick={() => apply(it)}
                >
                  <Check className="size-4" />
                </button>
                <button
                  className="btn-ghost size-8 grid place-items-center text-muted-fg"
                  title={tr(lang, "procrastination.skip")}
                  onClick={() =>
                    setData((d) => (d ? { ...d, items: d.items.filter((x) => x.id !== it.id) } : d))
                  }
                >
                  <XIcon className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.items.length === 0 && !procrastinate.isPending && (
        <p className="text-base text-muted-fg italic leading-relaxed">{tr(lang, "procrastination.allClear")}</p>
      )}
    </section>
  );
}
