"use client";

import { useTasks, useUpdateTask, type TaskWithTags, type TasksFilter } from "@/hooks/use-tasks";
import { useUIStore } from "@/store/ui";
import { Plus } from "lucide-react";
import {
  DndContext, DragEndEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { cn, priorityColorClass } from "@/lib/utils";

type Priority = 0 | 1 | 3 | 5;

const COLUMNS: { value: Priority; label: string; color: string }[] = [
  { value: 5, label: "High",   color: "hsl(var(--p-high))" },
  { value: 3, label: "Medium", color: "hsl(var(--p-med))" },
  { value: 1, label: "Low",    color: "hsl(var(--p-low))" },
  { value: 0, label: "None",   color: "hsl(var(--muted-fg))" },
];

export function KanbanView({
  title,
  subtitle,
  filter,
}: {
  title: string;
  subtitle?: string;
  filter: TasksFilter;
}) {
  const { data: tasks = [] } = useTasks(filter);
  const update = useUpdateTask();
  const setQuickAdd = useUIStore((s) => s.setQuickAddOpen);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const taskId = String(e.active.id);
    const newPriority = Number(e.over.id) as Priority;
    const t = tasks.find((x) => x.id === taskId);
    if (!t || t.priority === newPriority) return;
    update.mutate({ id: t.id, priority: newPriority });
  }

  const byCol: Record<number, TaskWithTags[]> = { 0: [], 1: [], 3: [], 5: [] };
  for (const t of tasks) byCol[t.priority]?.push(t);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-3 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted-fg mt-0.5">{subtitle}</p>}
        </div>
        <button className="btn-ghost gap-2" onClick={() => setQuickAdd(true)}>
          <Plus className="size-4" /> Quick add
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid grid-cols-4 gap-4 min-h-full">
            {COLUMNS.map((c) => (
              <Column
                key={c.value}
                col={c}
                tasks={byCol[c.value] ?? []}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  );
}

function Column({ col, tasks }: { col: typeof COLUMNS[number]; tasks: TaskWithTags[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: String(col.value) });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "card p-3 flex flex-col min-h-[400px] transition-colors",
        isOver && "bg-muted"
      )}
    >
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: col.color }} />
          <h3 className="font-medium" style={{ color: col.color }}>{col.label}</h3>
        </div>
        <span className="chip">{tasks.length}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {tasks.length === 0 && (
          <p className="text-xs text-muted-fg px-1 py-3">Drop tasks here.</p>
        )}
        {tasks.map((t) => <KanbanCard key={t.id} task={t} />)}
      </div>
    </div>
  );
}

function KanbanCard({ task }: { task: TaskWithTags }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const setSelected = useUIStore((s) => s.setSelectedTaskId);
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : {};
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onDoubleClick={() => setSelected(task.id)}
      className={cn(
        "rounded-md border border-border bg-bg p-2 cursor-grab active:cursor-grabbing text-sm",
        task.is_completed && "line-through text-muted-fg",
        isDragging && "ring-2 ring-accent shadow-lg"
      )}
    >
      <div className="truncate">{task.title}</div>
      {(task.due_at || task.tags.length > 0) && (
        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-fg">
          {task.due_at && (
            <span>{new Date(task.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          )}
          {task.tags.slice(0, 2).map((t) => (
            <span key={t.id} style={{ color: t.color }}>#{t.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}
