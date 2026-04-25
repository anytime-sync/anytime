"use client";

import { useTasks, type TasksFilter, type TaskWithTags } from "@/hooks/use-tasks";
import { TaskItem } from "./task-item";
import { useUIStore } from "@/store/ui";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useCreateTask } from "@/hooks/use-tasks";

type Props = {
  title: string;
  subtitle?: string;
  filter: TasksFilter;
  defaults?: { project_id?: string | null };
};

export function TaskListView({ title, subtitle, filter, defaults }: Props) {
  const { data: tasks = [], isLoading } = useTasks(filter);
  const setQuickAdd = useUIStore((s) => s.setQuickAddOpen);
  const create = useCreateTask();
  const [showCompleted, setShowCompleted] = useState(false);
  const [inline, setInline] = useState("");

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
        <form
          className="px-3 py-2 rounded-md border border-dashed border-border flex items-center gap-3 cursor-text"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!inline.trim()) return;
            await create.mutateAsync({
              title: inline.trim(),
              project_id: defaults?.project_id ?? null,
            });
            setInline("");
          }}
        >
          <span className="size-5 rounded-full border-2 border-muted-fg" />
          <input
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-fg"
            placeholder="Add task — Enter to save"
            value={inline}
            onChange={(e) => setInline(e.target.value)}
          />
        </form>

        {isLoading ? (
          <div className="text-sm text-muted-fg px-3">Loading…</div>
        ) : incomplete.length === 0 && completed.length === 0 ? (
          <div className="px-3 py-12 text-center text-muted-fg">
            <div className="text-3xl mb-2 font-display"><em>—</em></div>
            <p className="text-sm">Nothing here yet. Add your first task above.</p>
          </div>
        ) : null}

        {incomplete.map((t: TaskWithTags) => (
          <TaskItem key={t.id} task={t} />
        ))}

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
