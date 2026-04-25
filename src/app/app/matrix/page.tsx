"use client";

import { useState } from "react";
import { useTasks, useUpdateTask, type TaskWithTags } from "@/hooks/use-tasks";
import { TaskItem } from "@/components/app/task-item";
import { isPast, isToday, addDays, endOfDay } from "date-fns";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";

type QuadrantKey = "q1" | "q2" | "q3" | "q4";

const QUADRANTS: Record<QuadrantKey, { label: string; subtitle: string; accent: string }> = {
  q1: { label: "Do first",  subtitle: "Urgent · Important",         accent: "hsl(var(--p-high))" },
  q2: { label: "Schedule",  subtitle: "Not urgent · Important",     accent: "hsl(var(--p-low))" },
  q3: { label: "Delegate",  subtitle: "Urgent · Not important",     accent: "hsl(var(--p-med))" },
  q4: { label: "Eliminate", subtitle: "Not urgent · Not important", accent: "hsl(var(--muted-fg))" },
};

function targetForQuadrant(q: QuadrantKey): { priority: 0 | 1 | 3 | 5; due_at: string | null } {
  const eod = endOfDay(new Date()).toISOString();
  switch (q) {
    case "q1": return { priority: 5, due_at: eod };
    case "q2": return { priority: 5, due_at: null };
    case "q3": return { priority: 1, due_at: eod };
    case "q4": return { priority: 0, due_at: null };
  }
}

function classify(t: TaskWithTags): QuadrantKey {
  const tomorrow = addDays(new Date(), 1);
  const isUrgent = !!t.due_at && (() => {
    const d = new Date(t.due_at!);
    return isToday(d) || isPast(d) || d <= tomorrow;
  })();
  const isImportant = t.priority >= 3;
  if (isUrgent && isImportant)   return "q1";
  if (!isUrgent && isImportant)  return "q2";
  if (isUrgent && !isImportant)  return "q3";
  return "q4";
}

export default function MatrixPage() {
  const { data: tasks = [] } = useTasks({});
  const update = useUpdateTask();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  const buckets: Record<QuadrantKey, TaskWithTags[]> = { q1: [], q2: [], q3: [], q4: [] };
  for (const t of tasks) buckets[classify(t)].push(t);

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const q = String(e.over.id) as QuadrantKey;
    const t = tasks.find((x) => x.id === String(e.active.id));
    if (!t || classify(t) === q) return;
    const target = targetForQuadrant(q);
    update.mutate({
      id: t.id,
      priority: target.priority,
      due_at: target.due_at,
      is_all_day: target.due_at ? false : t.is_all_day,
    });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-3 border-b border-border">
        <h1 className="text-xl font-semibold">Eisenhower matrix</h1>
        <p className="text-xs text-muted-fg">Drag tasks between quadrants to change urgency × importance.</p>
      </div>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 grid-rows-2 gap-4">
          {(Object.keys(QUADRANTS) as QuadrantKey[]).map((k) => (
            <Quadrant key={k} qkey={k} tasks={buckets[k]} activeId={activeId} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 150 }}>
          {activeTask ? (
            <div className="rounded-md ring-2 ring-accent shadow-2xl bg-bg w-[320px]">
              <TaskItem task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Quadrant({ qkey, tasks, activeId }: { qkey: QuadrantKey; tasks: TaskWithTags[]; activeId: string | null }) {
  const meta = QUADRANTS[qkey];
  const { isOver, setNodeRef } = useDroppable({ id: qkey });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "card flex flex-col min-h-0 transition-colors",
        isOver && "ring-2 ring-accent bg-accent/5"
      )}
    >
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-medium" style={{ color: meta.accent }}>{meta.label}</h3>
          <p className="text-xs text-muted-fg">{meta.subtitle}</p>
        </div>
        <span className="chip">{tasks.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-fg p-3">Drop tasks here.</p>
        ) : (
          tasks.map((t) => <DraggableMatrixCard key={t.id} task={t} dimmed={activeId === t.id} />)
        )}
      </div>
    </div>
  );
}

function DraggableMatrixCard({ task, dimmed }: { task: TaskWithTags; dimmed?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "rounded-md cursor-grab active:cursor-grabbing",
        (dimmed || isDragging) && "opacity-30"
      )}
    >
      <TaskItem task={task} />
    </div>
  );
}
