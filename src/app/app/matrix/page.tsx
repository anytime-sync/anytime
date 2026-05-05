"use client";

import { useEffect, useState } from "react";
import { useTasks, useUpdateTask, type TaskWithTags } from "@/hooks/use-tasks";
import { TaskItem } from "@/components/app/task-item";
import { usePlanWeek, type PlanWeekSuggestion } from "@/hooks/use-ai";
import { toast } from "sonner";
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
  bgOpacity: number; // 0-100, applied as alpha to bg + pill
  bgBlur: number;    // 0-30 px, applied as backdrop-filter blur
};

const DEFAULT_QUADRANTS: Record<QuadrantKey, QuadMeta> = {
  q1: { label: "Do first",  subtitle: "Urgent · Important",       fg: "#B91C1C", bg: "rgba(239, 68, 68, 0.08)",  border: "#EF4444", pill: "rgba(239, 68, 68, 0.15)",  bgOpacity: 100, bgBlur: 0 },
  q2: { label: "Schedule",  subtitle: "Not urgent · Important",   fg: "#047857", bg: "rgba(16, 185, 129, 0.08)", border: "#10B981", pill: "rgba(16, 185, 129, 0.15)", bgOpacity: 100, bgBlur: 0 },
  q3: { label: "Delegate",  subtitle: "Urgent · Not important",   fg: "#B45309", bg: "rgba(245, 158, 11, 0.10)", border: "#F59E0B", pill: "rgba(245, 158, 11, 0.18)", bgOpacity: 100, bgBlur: 0 },
  q4: { label: "Eliminate", subtitle: "Not urgent · Not important", fg: "#475569", bg: "rgba(100, 116, 139, 0.08)", border: "#94A3B8", pill: "rgba(100, 116, 139, 0.15)", bgOpacity: 100, bgBlur: 0 },
};

/**
 * Re-color a CSS color (hex or rgb/rgba) with a given alpha (0-100 percent).
 * `opacityPercent === 100` returns the input untouched so existing rgba()
 * colors keep their baked-in alpha.
 */
function applyAlpha(color: string | null | undefined, opacityPercent: number): string | undefined {
  if (!color) return undefined;
  const pct = Math.max(0, Math.min(100, opacityPercent));
  if (pct >= 100) return color;
  const a = pct / 100;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(color);
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})`;
  }
  return color;
}

/**
 * Reads the admin's `site_quadrant_config` rows for the current locale
 * and merges them on top of the built-in defaults. Any field the admin
 * didn't customise stays on its default value, so the Sift always
 * renders even if the table is empty.
 */
function useQuadrantConfig(): Record<QuadrantKey, QuadMeta> {
  const [merged, setMerged] = useState<Record<QuadrantKey, QuadMeta>>(DEFAULT_QUADRANTS);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const locale =
          (typeof navigator !== "undefined" && navigator.language) || "en";
        const candidates = [locale, locale.split("-")[0] ?? "en", "en"];
        for (const c of candidates) {
          const res = await fetch(
            `/api/keywords/quadrants?locale=${encodeURIComponent(c)}`
          );
          if (!res.ok) continue;
          const j = await res.json().catch(() => ({}));
          const rows = (j.rows ?? []) as Array<{
            quadrant: "q1" | "q2" | "q3" | "q4";
            label: string | null;
            fg_color: string | null;
            bg_color: string | null;
            border_color: string | null;
            bg_opacity: number | null;
            bg_blur: number | null;
          }>;
          if (rows.length) {
            if (cancelled) return;
            const next: Record<QuadrantKey, QuadMeta> = { ...DEFAULT_QUADRANTS };
            for (const r of rows) {
              const k = r.quadrant as QuadrantKey;
              if (!(k in next)) continue; // ignore unknown quadrant values
              const base = next[k];
              next[k] = {
                ...base,
                label: r.label || base.label,
                fg: r.fg_color || base.fg,
                bg: r.bg_color || base.bg,
                border: r.border_color || base.border,
                // Pill follows the bg color if the admin set one, else
                // falls back to the original pill.
                pill: r.bg_color || base.pill,
                bgOpacity: r.bg_opacity == null ? base.bgOpacity : r.bg_opacity,
                bgBlur: r.bg_blur == null ? base.bgBlur : r.bg_blur,
              };
            }
            setMerged(next);
            return;
          }
        }
      } catch {
        // Silent fall back to defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return merged;
}

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
  const quadrants = useQuadrantConfig();

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
          <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight">The Sift</h1>
          <p className="hidden md:block text-sm text-muted-fg mt-1">Drag tasks between quadrants to change urgency × importance.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PlanMyWeekButton tasks={tasks} onApply={(id, q, p) => {
            const target = targetForQuadrant(q);
            update.mutate({ id, priority: p, due_at: target.due_at });
          }} />
        </div>
      </div>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="flex-1 overflow-y-auto p-3 md:p-6 grid grid-cols-1 md:grid-cols-2 md:grid-rows-2 gap-3 md:gap-4">
          {(Object.keys(quadrants) as QuadrantKey[]).map((k) => (
            <Quadrant key={k} qkey={k} meta={quadrants[k]} tasks={buckets[k]} activeId={activeId} />
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

function Quadrant({ qkey, meta, tasks, activeId }: { qkey: QuadrantKey; meta: QuadMeta; tasks: TaskWithTags[]; activeId: string | null }) {
  const { isOver, setNodeRef } = useDroppable({ id: qkey });
  const cellBg = applyAlpha(meta.bg, meta.bgOpacity);
  const blurFilter = meta.bgBlur > 0 ? `blur(${meta.bgBlur}px)` : undefined;
  return (
    <div
      ref={setNodeRef}
      style={{
        backgroundColor: cellBg,
        borderColor: isOver ? meta.border : "hsl(var(--border))",
        borderTopWidth: 3,
        borderTopColor: meta.border,
        backdropFilter: blurFilter,
        WebkitBackdropFilter: blurFilter,
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
          style={{ backgroundColor: applyAlpha(meta.pill, meta.bgOpacity), color: meta.fg }}
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

/* ---------- Plan-my-week: batch prioritizer ----------
   Sends the next-7-days-or-undated open tasks to the AI in a single
   call. The model sees the whole list at once and weights items
   relatively, which is the part one-by-one classification can't do. */

function PlanMyWeekButton({
  tasks,
  onApply,
}: {
  tasks: TaskWithTags[];
  onApply: (id: string, q: QuadrantKey, suggestedPriority: 0 | 1 | 3 | 5) => void;
}) {
  const planMutation = usePlanWeek();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PlanWeekSuggestion[] | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [running, setRunning] = useState(false);

  // Pick the slice of tasks worth planning: open, next 7 days OR undated.
  function pickHorizonTasks(): TaskWithTags[] {
    const horizonEnd = addDays(new Date(), 7);
    return tasks
      .filter((t) => !t.is_completed)
      .filter((t) => {
        if (!t.due_at) return true;          // undated work counts
        const d = new Date(t.due_at);
        return d <= horizonEnd;              // due this week
      })
      .slice(0, 30);
  }

  async function run() {
    const horizon = pickHorizonTasks();
    if (horizon.length === 0) {
      toast.message("No open tasks to plan in the next 7 days.");
      return;
    }
    setRunning(true);
    setOpen(true);
    setResults(null);
    setNotes("");
    try {
      const r = await planMutation.mutateAsync(
        horizon.map((t) => ({
          id: t.id,
          title: t.title,
          due_at: t.due_at,
          priority: t.priority,
          project: null,
        }))
      );
      if (!r) {
        toast.error("AI is currently disabled.");
        setOpen(false);
        return;
      }
      setResults(r.suggestions);
      setNotes(r.notes);
    } catch (e: any) {
      toast.error(e?.message?.includes("429")
        ? "Daily plan-week budget reached. Try again tomorrow."
        : "Couldn't plan your week — try again.");
      setOpen(false);
    } finally {
      setRunning(false);
    }
  }

  function applyAll() {
    if (!results) return;
    let n = 0;
    for (const s of results) {
      const k = (`q${s.quadrant}`) as QuadrantKey;
      onApply(s.id, k, s.suggested_priority);
      n++;
    }
    toast.success(`Applied ${n} suggestion${n !== 1 ? "s" : ""}.`);
    setOpen(false);
    setResults(null);
  }

  return (
    <>
      <button
        onClick={run}
        disabled={running}
        className="btn-primary gap-2 h-9 px-3 text-xs disabled:opacity-50"
        title="AI plans the next 7 days as a coherent whole"
      >
        <Sparkles className={cn("size-3.5", running && "animate-spin")} />
        {running ? "Planning…" : "Plan my week"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="card max-w-xl w-[92vw] p-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-xl">Your week</h2>
              {results && (
                <span className="text-xs text-muted-fg">
                  {results.length} item{results.length !== 1 && "s"}
                </span>
              )}
            </div>

            {running && (
              <p className="text-sm text-muted-fg">Reading the whole list…</p>
            )}

            {results && notes && (
              <p className="text-sm text-fg italic mb-3 leading-relaxed">{notes}</p>
            )}

            {results && results.length > 0 && (
              <ul className="space-y-2">
                {results.map((s) => {
                  const t = tasks.find((x) => x.id === s.id);
                  if (!t) return null;
                  return (
                    <li
                      key={s.id}
                      className="border border-border rounded-md p-3 flex items-start gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{t.title}</div>
                        <div className="text-xs text-muted-fg mt-0.5">
                          <span className="text-fg">Q{s.quadrant}</span> · p{s.suggested_priority} · {s.reason}
                        </div>
                      </div>
                      <button
                        className="btn-ghost size-8 grid place-items-center text-success"
                        title="Apply"
                        onClick={() => {
                          const k = (`q${s.quadrant}`) as QuadrantKey;
                          onApply(s.id, k, s.suggested_priority);
                          setResults((r) => (r ? r.filter((x) => x.id !== s.id) : null));
                        }}
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        className="btn-ghost size-8 grid place-items-center text-muted-fg"
                        title="Skip"
                        onClick={() =>
                          setResults((r) => (r ? r.filter((x) => x.id !== s.id) : null))
                        }
                      >
                        <XIcon className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {results && results.length === 0 && !running && (
              <p className="text-sm text-muted-fg">All clear — your week is already on track.</p>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                className="btn-ghost h-8 px-3 text-xs"
                onClick={() => { setOpen(false); setResults(null); }}
              >
                Close
              </button>
              {results && results.length > 0 && (
                <button
                  className="btn-primary h-8 px-3 text-xs"
                  onClick={applyAll}
                >
                  Apply all
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
