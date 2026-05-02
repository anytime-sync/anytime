"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  addDays,
  differenceInMinutes,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { Clock } from "lucide-react";
import { useTasks, useUpdateTask, type TaskWithTags } from "@/hooks/use-tasks";
import { useUIStore } from "@/store/ui";
import { cn, priorityColorClass } from "@/lib/utils";

/**
 * WeekTimeline Ã¢ÂÂ MonÃ¢ÂÂSun, 7-column timeline view of the current ISO week.
 */

const RAIL_START_HOUR = 6;
const RAIL_END_HOUR = 23;
const PX_PER_HOUR = 56;
const PX_PER_MIN = PX_PER_HOUR / 60;
const RAIL_HEIGHT = (RAIL_END_HOUR - RAIL_START_HOUR) * PX_PER_HOUR;
const SNAP_MINUTES = 15;
const HEADER_HEIGHT = 56;
const RAIL_WIDTH = 56;

function minutesFromRailStart(d: Date): number {
  return (d.getHours() - RAIL_START_HOUR) * 60 + d.getMinutes();
}

/**
 * Greedy column layout for overlapping events.
 */
function layoutColumns<T extends { startMin: number; endMin: number }>(
  events: T[]
): Map<T, { col: number; cols: number }> {
  const sorted = [...events].sort(
    (a, b) => a.startMin - b.startMin || a.endMin - b.endMin
  );
  const out = new Map<T, { col: number; cols: number }>();
  let cluster: T[] = [];
  let clusterEnd = -Infinity;

  function flush() {
    if (cluster.length === 0) return;
    const columns: T[][] = [];
    for (const ev of cluster) {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]!;
        if (col[col.length - 1]!.endMin <= ev.startMin) {
          col.push(ev);
          out.set(ev, { col: i, cols: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([ev]);
        out.set(ev, { col: columns.length - 1, cols: 0 });
      }
    }
    for (const ev of cluster) out.get(ev)!.cols = columns.length;
    cluster = [];
    clusterEnd = -Infinity;
  }

  for (const ev of sorted) {
    if (ev.startMin >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.endMin);
  }
  flush();
  return out;
}

export function WeekTimeline({ weekOffset = 0 }: { weekOffset?: number } = {}) {
  const update = useUpdateTask();
  const setSelected = useUIStore((s) => s.setSelectedTaskId);
  const { data: tasks = [] } = useTasks({ view: "all", includeCompleted: true });
  const [now, setNow] = useState(() => new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const weekStart = useMemo(
    () => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7),
    [now.toDateString(), weekOffset]
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const m = minutesFromRailStart(now);
    const target = Math.max(0, m * PX_PER_MIN - 200);
    containerRef.current.scrollTo({ top: target });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tasksForDay(day: Date): TaskWithTags[] {
    const ds = startOfDay(day).getTime();
    const de = ds + 24 * 60 * 60_000 - 1;
    return tasks.filter((t) => {
      if (t.is_all_day || !t.due_at) return false;
      const a = new Date(t.start_at ?? t.due_at).getTime();
      return a >= ds && a <= de;
    });
  }

  // All-day tasks (single OR multi-day) whose [start_at, due_at] range
  // covers this day. Rendered as colored chips in the strip above the
  // hourly grid so multi-day spans like 5/5-5/7 are visible across cells.
  function allDayTasksForDay(day: Date): TaskWithTags[] {
    const ds = startOfDay(day).getTime();
    const de = ds + 24 * 60 * 60_000 - 1;
    return tasks.filter((t) => {
      if (!t.is_all_day || !t.due_at) return false;
      const dueMs = startOfDay(new Date(t.due_at)).getTime();
      const startMs = t.start_at ? startOfDay(new Date(t.start_at)).getTime() : dueMs;
      return startMs <= de && dueMs >= ds;
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over, delta } = e;
    if (!over) return;
    const taskId = String(active.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.due_at) return;

    const dayKey = String(over.id).replace("day-", "");
    const parts = dayKey.split("-").map((s) => parseInt(s, 10));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return;
    const [yy, mm, dd] = parts as [number, number, number];
    const newDay = new Date(yy, mm - 1, dd);

    const origDue = new Date(task.due_at);
    const origStart = task.start_at
      ? new Date(task.start_at)
      : new Date(origDue.getTime() - 30 * 60_000);
    const origHour = origStart.getHours();
    const origMin = origStart.getMinutes();

    const dyMin = delta.y / PX_PER_MIN;
    const rawMin = origHour * 60 + origMin + dyMin;
    const snapped = Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES;
    const clamped = Math.max(
      RAIL_START_HOUR * 60,
      Math.min(RAIL_END_HOUR * 60 - SNAP_MINUTES, snapped)
    );
    const newHour = Math.floor(clamped / 60);
    const newMinute = clamped % 60;

    const newStart = new Date(newDay);
    newStart.setHours(newHour, newMinute, 0, 0);

    const dur = task.start_at
      ? Math.max(15, differenceInMinutes(origDue, new Date(task.start_at)))
      : 30;
    const newDue = new Date(newStart.getTime() + dur * 60_000);

    if (
      isSameDay(newDay, origStart) &&
      newStart.getTime() === origStart.getTime()
    )
      return;

    if (task.start_at) {
      update.mutate({
        id: task.id,
        start_at: newStart.toISOString(),
        due_at: newDue.toISOString(),
      });
    } else {
      update.mutate({ id: task.id, due_at: newDue.toISOString() });
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragEnd={onDragEnd}
    >
      <div ref={containerRef} className="flex-1 overflow-auto">
        <div className="flex relative">
          <div
            className="shrink-0 sticky left-0 bg-bg/60 backdrop-blur-md z-30 border-r border-border"
            style={{ width: RAIL_WIDTH }}
          >
            <div
              className="border-b border-border bg-bg/60 backdrop-blur-md"
              style={{ height: HEADER_HEIGHT }}
            />
            <div className="relative" style={{ height: RAIL_HEIGHT }}>
              {Array.from(
                { length: RAIL_END_HOUR - RAIL_START_HOUR + 1 },
                (_, i) => {
                  const h = RAIL_START_HOUR + i;
                  const top = i * PX_PER_HOUR;
                  return (
                    <span
                      key={h}
                      className="absolute pl-2 pr-1 text-[10px] text-muted-fg uppercase tracking-wider tabular-nums"
                      style={{ top: top - 6, left: 0 }}
                    >
                      {h === 0
                        ? "12 AM"
                        : h < 12
                        ? `${h} AM`
                        : h === 12
                        ? "12 PM"
                        : `${h - 12} PM`}
                    </span>
                  );
                }
              )}
            </div>
          </div>

          <div className="flex md:grid md:grid-cols-7 flex-1">
            {days.map((d) => (
              <DayColumn
                key={d.toISOString()}
                day={d}
                tasks={tasksForDay(d)}
                allDayTasks={allDayTasksForDay(d)}
                isToday={isSameDay(d, now)}
                now={now}
                onSelect={setSelected}
              />
            ))}
          </div>
        </div>
      </div>
    </DndContext>
  );
}

function DayColumn({
  day,
  tasks,
  allDayTasks,
  isToday,
  now,
  onSelect,
}: {
  day: Date;
  tasks: TaskWithTags[];
  allDayTasks: TaskWithTags[];
  isToday: boolean;
  now: Date;
  onSelect: (id: string) => void;
}) {
  const dayKey = format(day, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayKey}` });

  const timed = tasks
    .map((t) => {
      const due = new Date(t.due_at!);
      const start = t.start_at
        ? new Date(t.start_at)
        : new Date(due.getTime() - 30 * 60_000);
      const startMin = minutesFromRailStart(start);
      const endMin = minutesFromRailStart(due);
      return { task: t, start, due, startMin, endMin };
    })
    .sort((a, b) => a.startMin - b.startMin);

  const taskLayout = layoutColumns(timed);

  const nowTop = isToday ? minutesFromRailStart(now) * PX_PER_MIN : null;

  return (
    <div
      className={cn(
        "flex flex-col snap-start shrink-0 md:shrink",
        "min-w-[60vw] md:min-w-0",
        "border-l border-border first:border-l-0"
      )}
    >
      <div
        className={cn(
          "sticky top-0 z-20 bg-bg/60 backdrop-blur-md border-b border-border",
          "px-2 flex flex-col items-center justify-center text-center"
        )}
        style={{ height: HEADER_HEIGHT }}
      >
        <p
          className={cn(
            "editorial-number text-[10px]",
            isToday && "text-accent"
          )}
        >
          {format(day, "EEE")}
        </p>
        <p
          className={cn(
            "font-display text-base leading-tight tabular-nums",
            isToday && "text-accent"
          )}
        >
          {format(day, "MMM d")}
        </p>
      </div>

      {allDayTasks.length > 0 && (
        <div className="flex flex-col gap-0.5 px-1.5 py-1.5 border-b border-border bg-bg/60">
          {allDayTasks.slice(0, 3).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(t.id);
              }}
              className={cn(
                "px-1.5 py-0.5 rounded text-[11px] truncate text-left",
                priorityBg(t.priority),
                t.is_completed && "line-through opacity-60"
              )}
              title={t.title}
            >
              {t.title}
            </button>
          ))}
          {allDayTasks.length > 3 && (
            <span className="text-[10px] text-muted-fg px-1.5">
              + {allDayTasks.length - 3} more
            </span>
          )}
        </div>
      )}

      <div
        ref={setNodeRef}
        className={cn(
          "relative",
          isOver && "bg-accent/[0.06]",
          isToday && "bg-accent/[0.02]"
        )}
        style={{ height: RAIL_HEIGHT }}
      >
        {Array.from(
          { length: RAIL_END_HOUR - RAIL_START_HOUR + 1 },
          (_, i) => (
            <div
              key={i}
              aria-hidden
              className="absolute left-0 right-0 border-t border-border/60"
              style={{ top: i * PX_PER_HOUR }}
            />
          )
        )}

        {timed.map((t) => {
          const layout = taskLayout.get(t) ?? { col: 0, cols: 1 };
          return (
            <DraggableTask
              key={t.task.id}
              task={t.task}
              start={t.start}
              due={t.due}
              col={layout.col}
              cols={layout.cols}
              onSelect={onSelect}
            />
          );
        })}

        {nowTop != null && nowTop >= 0 && nowTop <= RAIL_HEIGHT && (
          <div
            aria-hidden
            className="absolute left-0 right-0 z-10 pointer-events-none"
            style={{ top: nowTop }}
          >
            <div className="h-px bg-danger" />
            <span className="absolute -top-1 left-0 size-2 rounded-full bg-danger" />
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableTask({
  task,
  start,
  due,
  col,
  cols,
  onSelect,
}: {
  task: TaskWithTags;
  start: Date;
  due: Date;
  col: number;
  cols: number;
  onSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });

  const startMin = minutesFromRailStart(start);
  const endMin = minutesFromRailStart(due);
  const visStart = Math.max(0, startMin);
  const visEnd = Math.min((RAIL_END_HOUR - RAIL_START_HOUR) * 60, endMin);
  if (visEnd <= visStart) return null;

  const top = visStart * PX_PER_MIN;
  const height = Math.max(24, (visEnd - visStart) * PX_PER_MIN - 2);
  const tone = priorityColorClass(task.priority);

  const gap = cols > 1 ? 2 : 0;

  const style: React.CSSProperties = {
    top,
    height,
    left: `calc(4px + (100% - 8px) * ${col} / ${cols})`,
    width: `calc((100% - 8px) / ${cols} - ${gap}px)`,
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onSelect(task.id);
      }}
      style={style}
      className={cn(
        "absolute rounded-md text-left px-2 py-1.5",
        "hover:shadow-sm transition-shadow",
        priorityBg(task.priority),
        "flex flex-col gap-0.5 overflow-hidden cursor-grab active:cursor-grabbing",
        "ring-1 ring-border/40",
        isDragging && "opacity-90 shadow-2xl ring-2 ring-accent z-20",
        task.is_completed && "opacity-60"
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[9px] uppercase tracking-wider tabular-nums",
          tone
        )}
      >
        <Clock className="size-2.5" />
        {format(start, "h:mm")}
      </span>
      <span
        className={cn(
          "text-xs font-medium leading-snug truncate",
          task.is_completed && "line-through"
        )}
      >
        {task.title}
      </span>
    </div>
  );
}

function priorityBg(priority: number): string {
  if (priority >= 5) return "bg-p-high/60 text-fg";
  if (priority >= 3) return "bg-p-med/60 text-fg";
  if (priority >= 1) return "bg-p-low/60 text-fg";
  return "bg-muted text-fg";
}

export function useWeekViewMode() {
  const [mode, setMode] = useState<"list" | "timeline">(() => {
    if (typeof window === "undefined") return "list";
    return (
      ((localStorage.getItem("fl.week7Mode") as "list" | "timeline") ??
        "list")
    );
  });
  function setAndPersist(m: "list" | "timeline") {
    setMode(m);
    try {
      localStorage.setItem("fl.week7Mode", m);
    } catch {}
  }
  return [mode, setAndPersist] as const;
}

export function WeekViewToggle({
  mode,
  setMode,
}: {
  mode: "list" | "timeline";
  setMode: (m: "list" | "timeline") => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden text-[11px] md:text-xs shrink-0">
      {(["list", "timeline"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={cn(
            "px-2 md:px-3 h-7 capitalize whitespace-nowrap",
            mode === m ? "bg-fg text-bg" : "btn-ghost rounded-none"
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
