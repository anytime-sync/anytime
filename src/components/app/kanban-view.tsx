"use client";

import { useState } from "react";
import { useTasks, useUpdateTask, type TaskWithTags, type TasksFilter } from "@/hooks/use-tasks";
import { useUIStore } from "@/store/ui";
import { Plus } from "lucide-react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { t as tr } from "@/lib/i18n";

type Priority = 0 | 1 | 3 | 5;

function buildColumns(lang: string): { value: Priority; label: string; color: string }[] {
  return [
    { value: 5, label: tr(lang, "kanban.priorityHigh"),   color: "hsl(var(--p-high))" },
    { value: 3, label: tr(lang, "kanban.priorityMedium"), color: "hsl(var(--p-med))" },
    { value: 1, label: tr(lang, "kanban.priorityLow"),    color: "hsl(var(--p-low))" },
    { value: 0, label: tr(lang, "kanban.priorityNone"),   color: "hsl(var(--muted-fg))" },
  ];
}

export function KanbanView({ title, subtitle, filter }: { title: string; subtitle?: string; filter: TasksFilter }) {
  const lang = useLanguage();
  const COLUMNS = buildColumns(lang);
  const { data: tasks = [] } = useTasks(filter);
  const update = useUpdateTask();
  const setQuickAdd = useUIStore((s) => s.setQuickAddOpen);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
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
          <Plus className="size-4" /> {tr(lang, "kanban.quickAdd")}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <DndContext
          sensors={sensors}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="grid grid-cols-4 gap-4 min-h-full">
            {COLUMNS.map((c) => (
              <Column key={c.value} col={c} tasks={byCol[c.value] ?? []} activeId={activeId} lang={lang} />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 150 }}>
            {activeTask ? <KanbanCardPreview task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function Column({ col, tasks, activeId, lang }: { col: ReturnType<typeof buildColumns>[number]; tasks: TaskWithTags[]; activeId: string | null; lang: string }) {
  const { isOver, setNodeRef } = useDroppable({ id: String(col.value) });
  return (
    <div ref={setNodeRef} className={cn("card p-3 flex flex-col min-h-[400px] transition-colors", isOver && "bg-muted")}>
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: col.color }} />
          <h3 className="font-medium" style={{ color: col.color }}>{col.label}</h3>
        </div>
        <span className="chip">{tasks.length}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {tasks.length === 0 && <p className="text-xs text-muted-fg px-1 py-3">{tr(lang, "kanban.dropHere")}</p>}
        {tasks.map((t) => <KanbanCard key={t.id} task={t} dimmed={activeId === t.id} />)}
      </div>
    </div>
  );
}

function KanbanCard({ task, dimmed }: { task: TaskWithTags; dimmed?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const setSelected = useUIStore((s) => s.setSelectedTaskId);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onDoubleClick={() => setSelected(task.id)}
      className={cn(
        "rounded-md border border-border bg-bg p-2 cursor-grab active:cursor-grabbing text-sm",
        task.is_completed && "line-through text-muted-fg",
        (dimmed || isDragging) && "opacity-30"
      )}
    >
      <CardBody task={task} />
    </div>
  );
}

function KanbanCardPreview({ task }: { task: TaskWithTags }) {
  return (
    <div className="rounded-md border border-border bg-bg p-2 text-sm shadow-2xl ring-2 ring-accent w-[260px]">
      <CardBody task={task} />
    </div>
  );
}

function CardBody({ task }: { task: TaskWithTags }) {
  return (
    <>
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
    </>
  );
}
