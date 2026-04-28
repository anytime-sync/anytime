"use client";

import { useTasks, type TasksFilter, type TaskWithTags } from "@/hooks/use-tasks";
import { TaskItem } from "./task-item";
import { useUIStore } from "@/store/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import { InlineTaskInput } from "./inline-task-input";
import { SortableTaskList } from "./sortable-task-list";
import { DailyEdition } from "./daily-edition";
import { AntiOverloadBanner } from "./anti-overload-banner";

type Props = {
  title: string;
  subtitle?: string;
  filter: TasksFilter;
  defaults?: { project_id?: string | null };
  /** Show the AI Daily Edition card and anti-overload banner (Today view). */
  showDailyEdition?: boolean;
  /** Optional element rendered to the right of the Quick add button —
   *  used by Today to show its List/Timeline toggle. */
  headerExtra?: React.ReactNode;
  /** "manual" (default) keeps drag-to-reorder. "due_at" sorts ascending
   *  by due date and disables manual reorder — used by Today, Tomorrow,
   *  Next 7, Next 90 where the deadline is the source of truth. */
  sortBy?: "manual" | "due_at";
};

/** Sort tasks ascending by due_at; tasks without a due_at fall to the
 *  bottom in stable creation order. */
function byDueAtAsc(a: TaskWithTags, b: TaskWithTags): number {
  const ad = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
  const bd = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
  if (ad !== bd) return ad - bd;
  const ac = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bc = b.created_at ? new Date(b.created_at).getTime() : 0;
  return ac - bc;
}

export function TaskListView({
  title,
  subtitle,
  filter,
  defaults,
  showDailyEdition,
  headerExtra,
  sortBy = "manual",
}: Props) {
  const { data: tasks = [], isLoading } = useTasks(filter);
  const setQuickAdd = useUIStore((s) => s.setQuickAddOpen);
  const [showCompleted, setShowCompleted] = useState(false);

  let incomplete = tasks.filter((t) => !t.is_completed);
  const completed = tasks.filter((t) => t.is_completed);

  if (sortBy === "due_at") {
    incomplete = [...incomplete].sort(byDueAtAsc);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl md:text-4xl tracking-tight truncate leading-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-fg mt-1 truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerExtra}
            {/* Icon-only on mobile so a long title gets the room it needs. */}
            <button
              className="btn-ghost gap-2 px-2 md:px-3"
              onClick={() => setQuickAdd(true)}
              aria-label="Quick add"
              title="Quick add"
            >
              <Plus className="size-4" />
              <span className="hidden md:inline">Quick add</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 md:px-3 py-3 space-y-3">
        {showDailyEdition && (
          <div className="px-3">
            <DailyEdition />
            <AntiOverloadBanner />
          </div>
        )}
        <InlineTaskInput defaultProjectId={defaults?.project_id ?? null} />

        {isLoading ? (
          <div className="text-sm text-muted-fg px-3">Loading…</div>
        ) : incomplete.length === 0 && completed.length === 0 ? (
          <div className="px-3 py-12 text-center text-muted-fg">
            <div className="text-3xl mb-2 font-display"><em>—</em></div>
            <p className="text-sm">Nothing here yet. Add your first task above.</p>
          </div>
        ) : null}

        {/* Date-based views sort by due_at and don't allow manual reorder.
            List / inbox views keep the sortable wrapper. */}
        {sortBy === "due_at" ? (
          <div className="space-y-1">
            {incomplete.map((t) => (
              <TaskItem key={t.id} task={t} />
            ))}
          </div>
        ) : (
          <SortableTaskList tasks={incomplete} />
        )}

        {completed.length > 0 && (
          <div className="pt-4">
            <button
              className="px-3 text-xs text-muted-fg hover:text-fg"
              onClick={() => setShowCompleted((v) => !v)}
            >
              {showCompleted ? "Hide" : "Show"} completed ({completed.length})
            </button>
            {showCompleted &&
              completed.map((t) => <TaskItem key={t.id} task={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}
