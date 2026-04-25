"use client";

import { useTasks, type TaskWithTags } from "@/hooks/use-tasks";
import { TaskItem } from "@/components/app/task-item";
import { isPast, isToday, addDays } from "date-fns";

/**
 * Eisenhower matrix: 2x2 by importance (priority) x urgency (due soon).
 *  - Important: priority >= 3
 *  - Urgent:    overdue or due today/tomorrow
 */
export default function MatrixPage() {
  const { data: tasks = [] } = useTasks({});
  const tomorrow = addDays(new Date(), 1);

  const isUrgent = (t: TaskWithTags) => {
    if (!t.due_at) return false;
    const d = new Date(t.due_at);
    return isToday(d) || isPast(d) || d <= tomorrow;
  };
  const isImportant = (t: TaskWithTags) => t.priority >= 3;

  const q1 = tasks.filter((t) => isUrgent(t) && isImportant(t));
  const q2 = tasks.filter((t) => !isUrgent(t) && isImportant(t));
  const q3 = tasks.filter((t) => isUrgent(t) && !isImportant(t));
  const q4 = tasks.filter((t) => !isUrgent(t) && !isImportant(t));

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-3 border-b border-border">
        <h1 className="text-xl font-semibold">Eisenhower matrix</h1>
        <p className="text-xs text-muted-fg">Prioritize by urgency × importance.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 grid-rows-2 gap-4">
        <Quadrant title="Do first" subtitle="Urgent · Important" accent="hsl(var(--p-high))" tasks={q1} />
        <Quadrant title="Schedule" subtitle="Not urgent · Important" accent="hsl(var(--p-low))" tasks={q2} />
        <Quadrant title="Delegate" subtitle="Urgent · Not important" accent="hsl(var(--p-med))" tasks={q3} />
        <Quadrant title="Eliminate" subtitle="Not urgent · Not important" accent="hsl(var(--muted-fg))" tasks={q4} />
      </div>
    </div>
  );
}

function Quadrant({
  title, subtitle, accent, tasks,
}: { title: string; subtitle: string; accent: string; tasks: TaskWithTags[] }) {
  return (
    <div className="card flex flex-col min-h-0">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-medium" style={{ color: accent }}>{title}</h3>
          <p className="text-xs text-muted-fg">{subtitle}</p>
        </div>
        <span className="chip">{tasks.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-fg p-3">Nothing here.</p>
        ) : (
          tasks.map((t) => <TaskItem key={t.id} task={t} />)
        )}
      </div>
    </div>
  );
}
