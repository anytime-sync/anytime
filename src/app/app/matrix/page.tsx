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

/**
 * Each quadrant gets its own distinct hue.
 *  Q1 Do first   — red    (crisis)
 *  Q2 Schedule   — emerald (strategic / important growth)
 *  Q3 Delegate   — amber   (interrupts)
 *  Q4 Eliminate  — slate   (waste)
 */
type QuadMeta = {
  label: string;
  subtitle: string;
  fg: string;     // text color
  bg: string;     // tinted card background
  border: string; // top accent / drop highlight
  pill: string;   // count chip bg
};

const QUADRANTS: Record<QuadrantKey, QuadMeta> = {
  q1: {
    label: "Do first", subtitle: "Urgent · Important",
    fg: "#B91C1C", bg: "rgba(239, 68, 68, 0.08)",
    border: "#EF4444", pill: "rgba(239, 68, 68, 0.15)",
  },
  q2: {
    label: "Schedule", subtitle: "Not urgent · Important",
    fg: "#047857", bg: "rgba(16, 185, 129, 0.08)",
    border: "#10B981", pill: "rgba(16, 185, 129, 0.15)",
  },
  q3: {
    label: "Delegate", subtitle: "Urgent · Not important",
    fg: "#B45309", bg: "rgba(245, 158, 11, 0.10)",
    border: "#F59E0B", pill: "rgba(245, 158, 11, 0.18)",
  },
  q4: {
    label: "Eliminate", subtitle: "Not urgent · Not important",
    fg: "#475569", bg: "rgba(100, 116, 139, 0.08)",
    border: "#94A3B8", pill: "rgba(100, 116, 139, 0.15)",
  },
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

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }
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
        <h1 className="font-display text-2xl tracking-tight">Eisenhower matrix</h1>
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
      style={{
        backgroundColor: meta.bg,
        borderColor: isOver ? meta.border : "hsl(var(--border))",
        borderTopWidth: 3,
        borderTopColor: meta.border,
      }}
      className={cn(
        "card flex flex-col min-h-0 transition-all",
        isOver && "ring-2 shadow-md",
      )}
    >
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg leading-tight" style={{ color: meta.fg }}>{meta.label}</h3>
          <p className="text-[11px] text-muted-fg uppercase tracking-[0.18em]">{meta.subtitle}</p>
        </div>
        <span
          className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-medium"
          style={{ backgroundColor: meta.pill, color: meta.fg }}
        >
          {tasks.length}
        </span>
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
