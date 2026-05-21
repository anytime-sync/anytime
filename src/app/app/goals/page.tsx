"use client";

import Link from "next/link";
import { useMemo, useEffect } from "react";import { useRouter } from "next/navigation";import { useCanUseFeature } from "@/hooks/use-feature-access";
import { ArrowRight, Sparkles, Target } from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { useUIStore } from "@/store/ui";

/**
 * /app/goals — outcome-shaped goals with progress visualization.
 *
 * Each Goal is backed by a Project (the Goal modal already creates one
 * per goal). We aggregate task completion per project to render the
 * progress bar shown in the /pricing carousel mockup.
 *
 * Empty state nudges the user to open the Goal modal — same shortcut
 * the sidebar uses.
 */
export default function GoalsPage() {
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks({});
  const setGoalModal = useUIStore((s) => s.setGoalModalOpen);const _canUse = useCanUseFeature("ai_goal_tracker");const _router = useRouter();useEffect(() => { if (!_canUse) _router.replace("/app/features"); }, [_canUse, _router]);

  // Compute progress per project.
  const goals = useMemo(() => {
    return projects.map((p) => {
      const projectTasks = tasks.filter((t) => t.project_id === p.id);
      const done = projectTasks.filter((t) => t.is_completed).length;
      const total = projectTasks.length;
      const pct = total === 0 ? 0 : Math.round((done / total) * 100);
      return { ...p, done, total, pct };
    });
  }, [projects, tasks]);

  // Group active vs completed (100% done) for visual hierarchy.
  const active = goals.filter((g) => g.pct < 100);
  const completed = goals.filter((g) => g.pct === 100 && g.total > 0);

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <p className="editorial-number text-[11px]">GOALS</p>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight">
            Outcomes, not checklists.
          </h1>
          <button
            onClick={() => setGoalModal(true)}
            className="btn-primary h-9 px-3 text-sm inline-flex items-center gap-1.5 shrink-0"
          >
            <Sparkles className="size-4" />
            New goal
          </button>
        </div>
        <p className="text-sm text-muted-fg mt-1">
          Each goal is a project — AI checks in every Friday and surfaces patterns in your weekly review.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-4xl space-y-10">

          {/* Empty state */}
          {goals.length === 0 && (
            <div className="border border-border rounded-2xl bg-stone-50 p-10 text-center">
              <Target className="size-8 text-accent/60 mx-auto mb-3" aria-hidden />
              <p className="font-display text-2xl text-stone-800 mb-1">
                Your first goal is one sentence away.
              </p>
              <p className="text-sm text-muted-fg mb-5 max-w-md mx-auto">
                Type the outcome you want. AI breaks it into 5–9 tracked sub-tasks and checks in weekly.
              </p>
              <button
                onClick={() => setGoalModal(true)}
                className="btn-primary h-10 px-4 text-sm inline-flex items-center gap-1.5"
              >
                <Sparkles className="size-4" />
                Set my first goal
              </button>
            </div>
          )}

          {/* Active goals */}
          {active.length > 0 && (
            <section>
              <h2 className="editorial-number text-[11px] mb-3">IN FLIGHT · {active.length}</h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {active.map((g) => (
                  <GoalCard key={g.id} goal={g} />
                ))}
              </ul>
            </section>
          )}

          {/* Completed goals */}
          {completed.length > 0 && (
            <section>
              <h2 className="editorial-number text-[11px] mb-3">SHIPPED · {completed.length}</h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completed.map((g) => (
                  <GoalCard key={g.id} goal={g} muted />
                ))}
              </ul>
            </section>
          )}

          {/* Friday check-in footer */}
          {goals.length > 0 && (
            <section className="border-t border-border pt-6 flex items-start gap-3 text-sm">
              <div className="size-8 rounded-full bg-accent/20 grid place-items-center shrink-0">
                <Sparkles className="size-4 text-accent" />
              </div>
              <div className="flex-1">
                <p className="font-medium">AI checks in every Friday.</p>
                <p className="text-muted-fg text-xs mt-0.5">
                  Your weekly review pulls patterns across all goals — what shipped, what stalled, what to pre-stage for next week.
                </p>
                <Link
                  href="/app/retro"
                  className="text-accent text-xs inline-flex items-center gap-1 mt-1 hover:underline"
                >
                  Open weekly review <ArrowRight className="size-3" />
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  muted,
}: {
  goal: { id: string; name: string; done: number; total: number; pct: number };
  muted?: boolean;
}) {
  return (
    <li>
      <Link
        href={`/app/lists/${goal.id}`}
        className={
          "block border border-border rounded-2xl p-4 transition-colors hover:bg-muted/20 " +
          (muted ? "opacity-70" : "")
        }
      >
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <p className="font-display text-lg leading-tight truncate">{goal.name}</p>
          <span className="text-xs text-muted-fg shrink-0 tabular-nums">
            {goal.done}/{goal.total} done
          </span>
        </div>
        <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden mb-1">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${goal.pct}%` }}
          />
        </div>
        <div className="flex items-baseline justify-between text-[11px] text-muted-fg">
          <span>{goal.pct}% complete</span>
          <span className="text-accent inline-flex items-center gap-1">
            Open <ArrowRight className="size-3" />
          </span>
        </div>
      </Link>
    </li>
  );
}
