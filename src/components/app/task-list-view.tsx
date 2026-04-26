"use client";

import { useTasks, type TasksFilter } from "@/hooks/use-tasks";
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
};

export function TaskListView({ title, subtitle, filter, defaults, showDailyEdition }: Props) {
  const { data: tasks = [], isLoading } = useTasks(filter);
  const setQuickAdd = useUIStore((s) => s.setQuickAddOpen);
  const [showCompleted, setShowCompleted] = useState(false);

  const incomplete = tasks.filter((t) => !t.is_completed);
  const completed = tasks.filter((t) => t.is_completed);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-3 border-b border-border">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl tracking-tight truncate">{title}</h1>
            {subtitle && <p className="text-xs text-muted-fg mt-0.5">{subtitle}</p>}
          </div>
          <button className="btn-ghost gap-2" onClick={() => setQuickAdd(true)}>
            <Plus className="size-4" />
            Quick add
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
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

        {/* Drag-to-reorder for the active list. Completed tasks stay below in
            chronological order; reordering them isn't useful. */}
        <SortableTaskList tasks={incomplete} />

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
