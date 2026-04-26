"use client";

import { useState } from "react";
import { useTasks, useUpdateTask, type TaskWithTags } from "@/hooks/use-tasks";
import { TaskItem } from "@/components/app/task-item";
import { useSuggestQuadrant } from "@/hooks/use-ai";
import { isPast, isToday, addDays, endOfDay } from "date-fns";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { Sparkles, Check, X as XIcon } from "lucide-react";
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
  fg: string;
  bg: string;
  border: string;
  pill: string;
};

const QUADRANTS: Record<QuadrantKey, QuadMeta> = {
  q1: { label: "Do first",  subtitle: "Urgent · Important",       fg: "#B91C1C", bg: "rgba(239, 68, 68, 0.08)",  border: "#EF4444", pill: "rgba(239, 68, 68, 0.15)" },
  q2: { label: "Schedule",  subtitle: "Not urgent · Important",   fg: "#047857", bg: "rgba(16, 185, 129, 0.08)", border: "#10B981", pill: "rgba(16, 185, 129, 0.15)" },
  q3: { label: "Delegate",  subtitle: "Urgent · Not important",   fg: "#B45309", bg: "rgba(245, 158, 11, 0.10)", border: "#F59E0B", pill: "rgba(245, 158, 11, 0.18)" },
  q4: { label: "Eliminate", subtitle: "Not urgent · Not important", fg: "#475569", bg: "rgba(100, 116, 139, 0.08)", border: "#94A3B8", pill: "rgba(100, 116, 139, 0.15)" },
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
    const { active, over } = e;
    if (!over) return;
    const q = String(over.id) as QuadrantKey;
    const t = tasks.find((x) => x.id === String(active.id));
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
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight">Eisenhower</h1>
          <p className="hidden md:block text-sm text-muted-fg mt-1">Drag tasks between quadrants to change urgency × importance.</p>
        </div>
        <SuggestQuadrantsButton tasks={tasks} onApply={(id, q) => {
          const target = targetForQuadrant(q);
          update.mutate({ id, priority: target.priority, due_at: target.due_at });
        }} />
      </div>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="flex-1 overflow-y-auto p-3 md:p-6 grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 gap-3 md:gap-4">
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
      className={cn("card flex flex-col min-h-0 transition-all", isOver && "ring-2 shadow-md")}
    >
      <div className="px-3 md:px-4 py-2 md:py-3 border-b border-border flex items-center justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <h3 className="font-display text-base md:text-lg leading-tight truncate" style={{ color: meta.fg }}>{meta.label}</h3>
          <p className="text-[10px] md:text-[11px] text-muted-fg uppercase tracking-[0.16em] md:tracking-[0.18em] truncate">{meta.subtitle}</p>
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
      className={cn("rounded-md cursor-grab active:cursor-grabbing", (dimmed || isDragging) && "opacity-30")}
    >
      <TaskItem task={task} />
    </div>
  );
}

/* ---------- AI: bulk-suggest quadrants for messy buckets ---------- */

type Suggestion = { task: TaskWithTags; quadrant: 1 | 2 | 3 | 4; reason: string; from: 1 | 2 | 3 | 4 };

function quadrantNumber(t: TaskWithTags): 1 | 2 | 3 | 4 {
  const k = classify(t);
  return k === "q1" ? 1 : k === "q2" ? 2 : k === "q3" ? 3 : 4;
}

function SuggestQuadrantsButton({
  tasks,
  onApply,
}: {
  tasks: TaskWithTags[];
  onApply: (id: string, q: QuadrantKey) => void;
}) {
  const suggest = useSuggestQuadrant();
  const [results, setResults] = useState<Suggestion[] | null>(null);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setResults(null);
    const candidates = tasks.filter((t) => !t.is_completed).slice(0, 12);
    const out: Suggestion[] = [];
    for (const t of candidates) {
      try {
        const r = await suggest.mutateAsync({
          title: t.title,
          due_at: t.due_at,
          priority: t.priority,
          project: null,
        });
        if (!r) continue;
        const fromKey = quadrantNumber(t);
        if (r.quadrant !== fromKey)
          out.push({ task: t, quadrant: r.quadrant, reason: r.reason, from: fromKey });
      } catch {}
    }
    setRunning(false);
    setResults(out);
  }

  return (
    <>
      <button
        onClick={run}
        disabled={running}
        className="btn-outline gap-2 h-9 px-3 text-xs disabled:opacity-50"
        title="Let AI suggest quadrants for tasks that look misplaced"
      >
        <Sparkles className={cn("size-3.5", running && "animate-spin")} />
        {running ? "Looking…" : "AI · suggest"}
      </button>

      {results && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 animate-fade-in"
          onClick={() => setResults(null)}
        >
          <div
            className="card max-w-xl w-[92vw] p-5 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-xl">Suggested moves</h2>
              <span className="text-xs text-muted-fg">{results.length} item{results.length !== 1 && "s"}</span>
            </div>
            {results.length === 0 ? (
              <p className="text-sm text-muted-fg">Nothing looks out of place.</p>
            ) : (
              <ul className="space-y-2">
                {results.map((s) => (
                  <li key={s.task.id} className="border border-border rounded-md p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{s.task.title}</div>
                      <div className="text-xs text-muted-fg mt-0.5">
                        Q{s.from} → <span className="text-fg">Q{s.quadrant}</span> · {s.reason}
                      </div>
                    </div>
                    <button
                      className="btn-ghost size-8 grid place-items-center text-success"
                      title="Apply"
                      onClick={() => {
                        const k = (`q${s.quadrant}`) as QuadrantKey;
                        onApply(s.task.id, k);
                        setResults((r) => r?.filter((x) => x.task.id !== s.task.id) ?? null);
                      }}
                    >
                      <Check className="size-4" />
                    </button>
                    <button
                      className="btn-ghost size-8 grid place-items-center text-muted-fg"
                      title="Skip"
                      onClick={() =>
                        setResults((r) => r?.filter((x) => x.task.id !== s.task.id) ?? null)
                      }
                    >
                      <XIcon className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <button className="btn-ghost h-8 px-3 text-xs" onClick={() => setResults(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
