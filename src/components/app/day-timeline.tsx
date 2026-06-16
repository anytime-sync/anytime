"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, isSameDay, startOfDay, endOfDay, differenceInMinutes } from "date-fns";
import { Clock, Plus } from "lucide-react";
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
import { useTasks, useUpdateTask, type TaskWithTags } from "@/hooks/use-tasks";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { CalendarEventChip } from "@/components/app/calendar-event-chip";
import type { CalendarEvent } from "@/lib/db.types";
import { useUserPrefs } from "@/hooks/use-ai";
import { useUIStore } from "@/store/ui";
import { cn, priorityColorClass } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";

const SNAP_MINUTES = 15;

const RAIL_START_HOUR = 6;
const RAIL_END_HOUR = 23;
const PX_PER_HOUR = 56;
const PX_PER_MIN = PX_PER_HOUR / 60;
const RAIL_HEIGHT = (RAIL_END_HOUR - RAIL_START_HOUR) * PX_PER_HOUR;

function minutesFromRailStart(d: Date): number {
  return (d.getHours() - RAIL_START_HOUR) * 60 + d.getMinutes();
}

function parseHHMM(s?: string | null): { h: number; m: number } | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return null;
  return { h: +m[1]!, m: +m[2]! };
}

/**
 * Greedy column layout for overlapping events (Google-Calendar style).
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

export function DayTimeline({ date }: { date: Date }) {
  const lang = useLanguage();
  const { data: tasks = [] } = useTasks({ view: "all", includeCompleted: true });
  const { data: prefs } = useUserPrefs();
  const setSelected = useUIStore((s) => s.setSelectedTaskId);
  const update = useUpdateTask();
  const dayStartForFetch = useMemo(() => startOfDay(date), [date.getTime()]);
  const dayEndForFetch = useMemo(() => endOfDay(date), [date.getTime()]);
  const { data: events = [] } = useCalendarEvents({ from: dayStartForFetch, to: dayEndForFetch });
  const containerRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const isToday = isSameDay(date, now);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, delta } = e;
    const taskId = String(active.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.due_at) return;

    const origDue = new Date(task.due_at);
    const origStart = task.start_at
      ? new Date(task.start_at)
      : new Date(origDue.getTime() - 30 * 60_000);

    const dyMin = delta.y / PX_PER_MIN;
    const rawMin =
      origStart.getHours() * 60 + origStart.getMinutes() + dyMin;
    const snapped = Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES;
    const clamped = Math.max(
      RAIL_START_HOUR * 60,
      Math.min(RAIL_END_HOUR * 60 - SNAP_MINUTES, snapped)
    );
    const newHour = Math.floor(clamped / 60);
    const newMin = clamped % 60;

    const newStart = new Date(date);
    newStart.setHours(newHour, newMin, 0, 0);

    if (newStart.getTime() === origStart.getTime()) return;

    const dur = task.start_at
      ? Math.max(15, differenceInMinutes(origDue, new Date(task.start_at)))
      : 30;
    const newDue = new Date(newStart.getTime() + dur * 60_000);

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

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isToday || !containerRef.current) return;
    const m = minutesFromRailStart(now);
    const target = Math.max(0, m * PX_PER_MIN - 200);
    containerRef.current.scrollTo({ top: target });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const dayTasks = useMemo(
    () =>
      tasks.filter((t) => {
        const anchor = t.start_at ?? t.due_at;
        if (!anchor) return false;
        const a = new Date(anchor);
        return a >= dayStart && a <= dayEnd;
      }),
    [tasks, dayStart.getTime(), dayEnd.getTime()]
  );

  const allDayTasks = dayTasks.filter((t) => t.is_all_day || (!t.start_at && !t.due_at));
  const RAIL_MAX_MIN = (RAIL_END_HOUR - RAIL_START_HOUR) * 60;
  const timed = dayTasks
    .filter((t) => !t.is_all_day && t.due_at)
    .map((t) => {
      const rawDue = new Date(t.due_at!);
      // Resolve a start/end pair that always spans a real interval so the
      // chip is visible AND positioned at its labeled time.
      //  - Has start_at and start < due  -> use as-is.
      //  - Has start_at but start >= due (zero-duration / point-in-time)
      //    OR has only due  -> render a 30-min block STARTING at the
      //    anchor time (start = anchor, end = anchor + 30), so a task
      //    labeled "12:00 PM" sits at 12:00, not 11:30. (2026-06-16)
      const explicitStart = t.start_at ? new Date(t.start_at) : null;
      let start: Date;
      let due: Date;
      if (explicitStart && explicitStart.getTime() < rawDue.getTime()) {
        start = explicitStart;
        due = rawDue;
      } else {
        const anchor = explicitStart ?? rawDue;
        start = anchor;
        due = new Date(anchor.getTime() + 30 * 60_000);
      }
      const startMin = minutesFromRailStart(start);
      const endMin = minutesFromRailStart(due);
      // Clamp the chip into the visible 6 AM–11 PM rail. Tasks that fall
      // entirely before 6 AM or after 11 PM (e.g. a 12:30 AM "Closing")
      // used to be dropped silently. Instead, pin them to the nearest
      // rail edge with a minimum height so they remain visible and
      // clickable — the chip's own label still shows the true time.
      let visStart = Math.max(0, Math.min(RAIL_MAX_MIN, startMin));
      let visEnd = Math.max(0, Math.min(RAIL_MAX_MIN, endMin));
      // Guarantee a minimum visible slice (30 min) so zero-duration and
      // out-of-range tasks are never invisible AND have room to show their
      // name. 30 min @ 56px/hr = 28px tall.
      const MIN_SLICE = 30;
      if (visEnd - visStart < MIN_SLICE) {
        if (visStart >= RAIL_MAX_MIN) {
          visStart = RAIL_MAX_MIN - MIN_SLICE;
          visEnd = RAIL_MAX_MIN;
        } else {
          visEnd = Math.min(RAIL_MAX_MIN, visStart + MIN_SLICE);
        }
      }
      return { task: t, start, due, startMin, endMin, visStart, visEnd };
    })
    .sort((a, b) => a.startMin - b.startMin);

  const dayStartForLayout = startOfDay(date);
  const dayEndForLayout = endOfDay(date);

  // Calendar events: lay them out in a thin left-edge lane so they
  // don't fight with task chips for horizontal space. We compute the
  // same startMin/endMin values as task layout, clamp to the visible
  // hour rail, and skip all-day events (those render in the all-day
  // header section above).
  const calEvents = events
    .filter((e: CalendarEvent) => !e.is_all_day && e.start_at && e.end_at)
    .map((e: CalendarEvent) => {
      const start = new Date(e.start_at!);
      const end = new Date(e.end_at!);
      // Clip to today's window — multi-day events get visually cropped
      // rather than spanning past the visible rail.
      const sClipped = start < dayStartForLayout ? dayStartForLayout : start;
      const eClipped = end > dayEndForLayout ? dayEndForLayout : end;
      const startMin = minutesFromRailStart(sClipped);
      const endMin = minutesFromRailStart(eClipped);
      const visStart = Math.max(0, startMin);
      const visEnd = Math.min((RAIL_END_HOUR - RAIL_START_HOUR) * 60, endMin);
      return { event: e, visStart, visEnd };
    })
    .filter((e) => e.visEnd > e.visStart);
  const allDayEvents = events.filter((e: CalendarEvent) => e.is_all_day);

  const buffers: Array<{ key: string; top: number; minutes: number }> = [];
  for (let i = 0; i < timed.length - 1; i++) {
    const a = timed[i]!;
    const b = timed[i + 1]!;
    const gap = b.startMin - a.endMin;
    if (gap >= 10) {
      const top = (a.endMin + gap / 2) * PX_PER_MIN;
      buffers.push({ key: `${a.task.id}-${b.task.id}`, top, minutes: gap });
    }
  }

  const peak = (() => {
    const a = parseHHMM(prefs?.energy_peak_start);
    const b = parseHHMM(prefs?.energy_peak_end);
    if (!a || !b) return null;
    const startMin = (a.h - RAIL_START_HOUR) * 60 + a.m;
    const endMin = (b.h - RAIL_START_HOUR) * 60 + b.m;
    if (endMin <= startMin) return null;
    return { top: startMin * PX_PER_MIN, height: (endMin - startMin) * PX_PER_MIN };
  })();

  const nowTop = isToday ? minutesFromRailStart(now) * PX_PER_MIN : null;

  const taskLayout = layoutColumns(timed);

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      {(allDayTasks.length > 0 || allDayEvents.length > 0) && (
        <div className="border-b border-border px-4 md:px-6 py-2 space-y-1">
          <p className="editorial-number text-[10px]">{t(lang, "dayTimeline.allDay")}</p>
          <div className="flex flex-wrap gap-1.5">
            {allDayTasks.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 h-6 rounded text-xs",
                  "bg-muted hover:bg-muted/80",
                  t.is_completed && "line-through opacity-60"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    priorityColorClass(t.priority).replace("text-", "bg-")
                  )}
                />
                {t.title}
              </button>
            ))}
            {allDayEvents.map((ev) => (
              <CalendarEventChip key={`evad-${ev.id}`} event={ev} lang={lang} size="compact" className="h-6 px-2 text-[11px] w-auto" />
            ))}
          </div>
        </div>
      )}
      <div className="relative" style={{ height: RAIL_HEIGHT }}>
        {peak && (
          <div
            aria-hidden
            className="absolute left-14 right-4 bg-accent/[0.06] border-l-2 border-accent/30"
            style={{ top: peak.top, height: peak.height }}
          />
        )}

        {Array.from({ length: RAIL_END_HOUR - RAIL_START_HOUR + 1 }, (_, i) => {
          const h = RAIL_START_HOUR + i;
          const top = i * PX_PER_HOUR;
          return (
            <div
              key={h}
              className="absolute left-0 right-0 flex items-start"
              style={{ top }}
            >
              <span className="w-14 pl-3 pr-2 text-[10px] text-muted-fg uppercase tracking-wider tabular-nums">
                {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
              </span>
              <div className="flex-1 border-t border-border/60" />
            </div>
          );
        })}

        {buffers.map((b) => (
          <div
            key={b.key}
            aria-hidden
            className="absolute left-14 right-4 text-center text-[10px] text-muted-fg/70"
            style={{ top: b.top - 6 }}
          >
            {b.minutes < 60 ? `${b.minutes} min` : `${Math.round((b.minutes / 60) * 10) / 10}h`} buffer
          </div>
        ))}

        {/* Google Calendar events — gray left-edge lane that lives
            alongside task cards. Click opens the event in Google
            Calendar (new tab). */}
        {calEvents.map((c) => {
          const top = c.visStart * PX_PER_MIN;
          const height = Math.max(20, (c.visEnd - c.visStart) * PX_PER_MIN - 2);
          return (
            <CalendarEventChip
              key={`evt-${c.event.id}`}
              event={c.event}
              lang={lang}
              size="timeline"
              style={{ top, height, left: 56, width: 68 }}
            />
          );
        })}
        <DayDropZone leftPx={calEvents.length > 0 ? 132 : 56}>
          {timed.map((t) => {
            const top = t.visStart * PX_PER_MIN;
            const height = Math.max(24, (t.visEnd - t.visStart) * PX_PER_MIN - 2);
            const tone = priorityColorClass(t.task.priority);
            const { col, cols } = taskLayout.get(t) ?? { col: 0, cols: 1 };
            const widthPct = 100 / cols;
            const gap = cols > 1 ? 4 : 0;
            return (
              <DraggableCard
                key={t.task.id}
                task={t.task}
                top={top}
                height={height}
                left={`${col * widthPct}%`}
                width={`calc(${widthPct}% - ${gap}px)`}
                tone={tone}
                start={t.start}
                due={t.due}
                cols={cols}
                onSelect={setSelected}
              />
            );
          })}
        </DayDropZone>

        {nowTop != null && nowTop >= 0 && nowTop <= RAIL_HEIGHT && (
          <div
            aria-hidden
            className="absolute left-0 right-0 z-10 pointer-events-none"
            style={{ top: nowTop }}
          >
            <div className="flex items-center">
              <span className="w-14 pl-3 pr-2 text-[10px] font-medium text-danger tabular-nums">
                {format(now, "h:mm")}
              </span>
              <div className="flex-1 h-px bg-danger" />
              <span className="size-2 -mr-1 rounded-full bg-danger" />
            </div>
          </div>
        )}
      </div>
    </div>
    </DndContext>
  );
}

function DayDropZone({ children, leftPx }: { children: React.ReactNode; leftPx?: number }) {
  const { setNodeRef } = useDroppable({ id: "day-drop" });
  return (
    <div
      ref={setNodeRef}
      className="absolute inset-y-0 right-4 pointer-events-none"
      style={{ left: leftPx ?? 56 }}
    >
      {children}
    </div>
  );
}

function DraggableCard({
  task,
  top,
  height,
  left,
  width,
  tone,
  start,
  due,
  cols,
  onSelect,
}: {
  task: TaskWithTags;
  top: number;
  height: number;
  left: string;
  width: string;
  tone: string;
  start: Date;
  due: Date;
  cols: number;
  onSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });

  // Short chips (e.g. 15-30 min, or zero-duration tasks pinned to a small
  // slice) don't have vertical room to stack the time row above the title.
  // Below this threshold we render a single compact row: title first, with
  // the time tucked after it, so the task NAME is always visible. Above it
  // we keep the editorial stacked layout (time over title).
  const isCompact = height < 44;

  const style: React.CSSProperties = {
    top,
    height,
    left,
    width,
    borderColor: "hsl(var(--border))",
    borderLeftWidth: 3,
    borderLeftColor: "currentColor",
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
      title={`${task.title} · ${format(start, "h:mm a")} – ${format(due, "h:mm a")}`}
      className={cn(
        "absolute rounded-md text-left pointer-events-auto",
        isCompact ? "px-2 py-0.5" : "px-3 py-2",
        "border bg-bg/75 backdrop-blur-sm hover:shadow-sm transition-shadow",
        "overflow-hidden",
        "cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-90 shadow-2xl ring-2 ring-accent z-20",
        task.is_completed && "opacity-60"
      )}
    >
      {isCompact ? (
        // One-line: NAME (truncated) + time, so the title is never hidden.
        <div className="flex items-center gap-1.5 leading-tight">
          <span
            className={cn(
              "text-xs font-medium truncate",
              task.is_completed && "line-through"
            )}
          >
            {task.title}
          </span>
          <span
            className={cn(
              "shrink-0 text-[9px] uppercase tracking-wider tabular-nums opacity-70",
              tone
            )}
          >
            {format(start, "h:mm a")}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider tabular-nums",
              tone
            )}
          >
            <Clock className="size-3" />
            {format(start, "h:mm a")} – {format(due, "h:mm a")}
          </span>
          <span
            className={cn(
              "text-sm font-medium leading-snug truncate",
              task.is_completed && "line-through"
            )}
          >
            {task.title}
          </span>
          {task.notes && height > 56 && cols === 1 && (
            <span className="text-[11px] text-muted-fg leading-snug line-clamp-2">
              {task.notes}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function useDayViewMode() {
  const [mode, setMode] = useState<"list" | "timeline">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("fl.dayMode") as any) ?? "list";
  });
  function setAndPersist(m: "list" | "timeline") {
    setMode(m);
    try { localStorage.setItem("fl.dayMode", m); } catch {}
  }
  return [mode, setAndPersist] as const;
}

export function DayViewToggle({
  mode,
  setMode,
}: {
  mode: "list" | "timeline";
  setMode: (m: "list" | "timeline") => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden text-xs shrink-0">
      {(["list", "timeline"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={cn(
            "px-3 h-7 capitalize",
            mode === m ? "bg-fg text-bg" : "btn-ghost rounded-none"
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
