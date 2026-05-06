"use client";

import { useState } from "react";
import { Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { addDays } from "date-fns";
import { useUIStore } from "@/store/ui";
import { useGoalDecompose, type GoalDecomposed } from "@/hooks/use-ai";
import { useCreateProject } from "@/hooks/use-projects";
import { useCreateTask } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";

/**
 * "+ Goal" modal. User types a goal sentence, AI returns a project +
 * 5-9 tasks. User can tweak titles inline, then "Create" inserts a new
 * project and bulk-creates the tasks under it.
 */
export function GoalModal() {
  const open = useUIStore((s) => s.goalModalOpen);
  const setOpen = useUIStore((s) => s.setGoalModalOpen);
  const decompose = useGoalDecompose();
  const createProject = useCreateProject();
  const createTask = useCreateTask();
  const [goal, setGoal] = useState("");
  const [plan, setPlan] = useState<GoalDecomposed | null>(null);
  const [running, setRunning] = useState(false);
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  async function generate() {
    if (!goal.trim()) return;
    setRunning(true);
    setPlan(null);
    try {
      const r = await decompose.mutateAsync(goal.trim());
      if (!r) {
        toast.error("AI is currently disabled.");
        return;
      }
      setPlan(r);
    } catch (e: any) {
      toast.error(
        e?.message?.includes("429")
          ? "Daily goal-decompose budget reached."
          : "Couldn't plan that goal — try again."
      );
    } finally {
      setRunning(false);
    }
  }

  async function commit() {
    if (!plan) return;
    setCreating(true);
    try {
      const proj = await createProject.mutateAsync({ name: plan.project_name } as any);
      const projectId = (proj as any)?.id ?? null;
      for (const t of plan.tasks) {
        const due = addDays(new Date(), t.due_offset_days);
        // Treat all-day for clarity; user can refine after.
        due.setHours(23, 59, 0, 0);
        await createTask.mutateAsync({
          title: t.title,
          due_at: due.toISOString(),
          is_all_day: false,
          priority: t.priority,
          project_id: projectId,
        } as any);
      }
      toast.success(`Goal planned: ${plan.tasks.length} task${plan.tasks.length !== 1 ? "s" : ""} added`);
      setOpen(false);
      setGoal("");
      setPlan(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create the plan");
    } finally {
      setCreating(false);
    }
  }

  function discard() {
    setOpen(false);
    setGoal("");
    setPlan(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 animate-fade-in px-4"
      onClick={discard}
    >
      <div
        className="card max-w-2xl w-full p-5 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-2xl">A goal</h2>
          {plan && (
            <span className="text-xs text-muted-fg">
              {plan.tasks.length} step{plan.tasks.length !== 1 && "s"}
            </span>
          )}
        </div>

        {!plan && (
          <>
            <p className="text-base text-muted-fg mb-3 italic font-display leading-relaxed">
              Write the outcome you want. AI breaks it into a project + tasks
              you can ship in order.
            </p>
            <textarea
              autoFocus
              rows={3}
              className="input w-full text-base"
              placeholder="e.g. Ship the Q4 launch by Nov 30 with full email + social coverage"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
              }}
            />
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-fg">
                <kbd>{typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘" : "Ctrl"}+Enter</kbd> to plan
              </p>
              <div className="flex items-center gap-2">
                <button className="btn-ghost h-9 px-3 text-sm" onClick={discard}>
                  Cancel
                </button>
                <button
                  className="btn-primary h-9 px-3 text-sm gap-1.5 inline-flex items-center disabled:opacity-50"
                  onClick={generate}
                  disabled={running || !goal.trim()}
                >
                  <Sparkles className={cn("size-3.5", running && "animate-spin")} />
                  {running ? "Planning…" : "Plan it"}
                </button>
              </div>
            </div>
          </>
        )}

        {plan && (
          <>
            <div className="border border-border rounded-md p-3 mb-3">
              <div className="text-xs uppercase tracking-wider text-muted-fg mb-1">
                Project
              </div>
              <div className="font-medium text-base">~{plan.project_name}</div>
              <p className="text-sm text-muted-fg mt-1 italic leading-relaxed">{plan.summary}</p>
            </div>
            <ul className="space-y-2">
              {plan.tasks.map((t, i) => (
                <li
                  key={i}
                  className="border border-border rounded-md p-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <input
                      className="input w-full text-base py-1 mb-1 bg-transparent border-none px-0 focus:bg-bg focus:border focus:border-border focus:px-2 focus:py-1.5 rounded-md"
                      value={t.title}
                      onChange={(e) =>
                        setPlan((p) =>
                          p
                            ? {
                                ...p,
                                tasks: p.tasks.map((x, j) =>
                                  j === i ? { ...x, title: e.target.value } : x
                                ),
                              }
                            : p
                        )
                      }
                    />
                    <div className="text-xs text-muted-fg">
                      <span className="text-fg">Q{t.quadrant}</span> · p{t.priority} · in{" "}
                      {t.due_offset_days === 0 ? "today" : `${t.due_offset_days}d`} · {t.rationale}
                    </div>
                  </div>
                  <button
                    className="btn-ghost size-7 grid place-items-center text-muted-fg"
                    title="Remove"
                    onClick={() =>
                      setPlan((p) =>
                        p ? { ...p, tasks: p.tasks.filter((_, j) => j !== i) } : p
                      )
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                className="btn-ghost h-9 px-3 text-sm"
                onClick={() => setPlan(null)}
                disabled={creating}
              >
                Back
              </button>
              <button
                className="btn-primary h-9 px-3 text-sm gap-1.5 inline-flex items-center disabled:opacity-50"
                onClick={commit}
                disabled={creating || plan.tasks.length === 0}
              >
                <Check className="size-3.5" />
                {creating ? "Creating…" : `Create ${plan.tasks.length} task${plan.tasks.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
