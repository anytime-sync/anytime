"use client";

import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, startOfDay, endOfDay, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Plus, ArrowLeft } from "lucide-react";
import { useTasks, useUpdateTask, type TaskWithTags } from "@/hooks/use-tasks";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { CalendarEventChip } from "@/components/app/calendar-event-chip";
import { EventEditDialog } from "@/components/app/event-edit-dialog";
import { EventTaskRow } from "@/components/app/event-task-row";
import { DraggableEventChip } from "@/components/app/draggable-event-chip";
import type { CalendarEvent } from "@/lib/db.types";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { TaskItem } from "@/components/app/task-item";
import { InlineTaskInput } from "@/components/app/inline-task-input";
import { useLanguage } from "@/lib/use-language";
import { t as tr, getLanguage } from "@/lib/i18n";

/**
 * Calendar — month grid with click-through to single-day view.
 *
 * Two modes, switched by `mode` state:
 *   - "month": classic 7×6 grid, drag tasks across days, see at-a-glance
 *   - "day":   single day shown as a clean editorial list with prev/next
 *              arrows; lands when the user clicks a date number on the
 *              month grid OR the empty area of a day cell.
 *
 * Day view re-uses TaskItem + InlineTaskInput so behavior matches the
 * Today page exactly (drag-to-reorder, inline AI parsing, tag pills).
 */
export default function CalendarPage() {
  const [mode, setMode] = useState<"month" | "day">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  return mode === "day" ? (
    <DayView
      date={selectedDate}
      onChangeDate={setSelectedDate}
      onBack={() => setMode("month")}
    />
  ) : (
    <MonthView
      cursor={cursor}
      setCursor={setCursor}
      onPickDay={(d) => {
        setSelectedDate(d);
        setMode("day");
      }}
    />
  );
}

/* ------------------------ Month view ------------------------ */

function MonthView({
  cursor,
  setCursor,
  onPickDay,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  onPickDay: (d: Date) => void;
}) {
  const lang = useLanguage();
  const dfLocale = getLanguage(lang).dateFnsLocale;
  const setQuickAdd = useUIStore((s) => s.setQuickAddOpen);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart.getTime(), gridEnd.getTime()]
  );

  const { data: tasks = [] } = useTasks({ view: "all", includeCompleted: true });
  // Fetch every event that overlaps the visible grid (typ. 6 weeks).
  // RLS-gated query — supabase reads only this user's rows.
  const { data: calEventsAll = [] } = useCalendarEvents({
    from: startOfDay(gridStart),
    to: endOfDay(gridEnd),
  });
  // Group by day for O(1) cell lookup; key by yyyy-MM-dd in local TZ.
  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const ev of calEventsAll) {
      if (!ev.start_at) continue;
      // Round F v4.7 fix: skip multi-day events — they render as a single
      // continuous bar via multiDayBars, so per-day chips would duplicate
      // them visually (same logic the task path uses for multi-day tasks).
      if (ev.end_at) {
        const startMs = startOfDay(new Date(ev.start_at)).getTime();
        const rawEndMs = startOfDay(new Date(ev.end_at)).getTime();
        const endMs = ev.is_all_day ? rawEndMs - 86400000 : rawEndMs;
        if (endMs > startMs) continue;
      }
      const k = format(new Date(ev.start_at), "yyyy-MM-dd");
      const arr = m.get(k) ?? [];
      arr.push(ev);
      m.set(k, arr);
    }
    return m;
  }, [calEventsAll]);

  const update = useUpdateTask();
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  // The active drag's source day — encoded in the draggable id so
  // multi-day chips know which of their covered days the user grabbed
  // from. Format: "<taskId>::<yyyy-mm-dd>".
  // Round F v4.6: when the user drags a GCal event chip, the active id
  // starts with "event::". Resolve to the event so DragOverlay can preview
  // it the same way it previews tasks.
  const activeItem = useMemo<
    | { kind: "task"; task: TaskWithTags }
    | { kind: "event"; event: CalendarEvent }
    | null
  >(() => {
    if (!activeId) return null;
    const idStr = String(activeId);
    if (idStr.startsWith("event::")) {
      const eventId = idStr.split("::")[1];
      const ev = calEventsAll.find((e) => e.id === eventId);
      return ev ? { kind: "event", event: ev } : null;
    }
    const taskId = idStr.split("::")[0];
    const t = tasks.find((x) => x.id === taskId);
    return t ? { kind: "task", task: t } : null;
  }, [activeId, tasks, calEventsAll]);
  const activeTask = activeItem && activeItem.kind === "task" ? activeItem.task : null;

  // Multi-day bars: one segment per visible week-row, positioned via
  // CSS grid-column so the bar overlays exactly the covered cells.
  // Re-uses the same 7×6 grid the cells live in; cells stay click-
  // through because the bar is rendered above with pointer-events
  // routed only at its draggable inner element.
  const multiDayBars = useMemo(() => {
    type Bar = {
      kind: "task" | "event";
      task?: TaskWithTags;
      event?: CalendarEvent;
      weekRow: number;       // 0..5
      startCol: number;      // 1..7 (CSS grid col)
      endCol: number;        // 1..7
      isFirstSegment: boolean;
      isLastSegment: boolean;
      segDays: Date[];       // dates this bar segment covers, left-to-right
      lane: number;          // vertical stack position within its week-row
    };
    const out: Bar[] = [];
    if (days.length === 0) return out;
    const firstMs = startOfDay(days[0]).getTime();
    const lastMs = startOfDay(days[days.length - 1]).getTime();
    for (const t of tasks) {
      if (!t.start_at || !t.due_at) continue;
      const s = startOfDay(new Date(t.start_at)).getTime();
      const e = startOfDay(new Date(t.due_at)).getTime();
      if (s === e) continue; // single-day → rendered as a chip in its cell
      if (s > lastMs || e < firstMs) continue;
      const clampedS = Math.max(s, firstMs);
      const clampedE = Math.min(e, lastMs);
      const startIdx = days.findIndex((d) => startOfDay(d).getTime() === clampedS);
      const endIdx = days.findIndex((d) => startOfDay(d).getTime() === clampedE);
      if (startIdx < 0 || endIdx < 0) continue;
      const startRow = Math.floor(startIdx / 7);
      const endRow = Math.floor(endIdx / 7);
      for (let row = startRow; row <= endRow; row++) {
        const rowStart = row * 7;
        const rowEnd = rowStart + 6;
        const segS = Math.max(startIdx, rowStart);
        const segE = Math.min(endIdx, rowEnd);
        out.push({
          kind: "task",
          task: t,
          weekRow: row,
          startCol: segS - rowStart + 1,
          endCol: segE - rowStart + 1,
          isFirstSegment: row === startRow && s === clampedS,
          isLastSegment: row === endRow && e === clampedE,
          segDays: days.slice(segS, segE + 1),
          lane: 0,
        });
      }
    }
    // Round F v4.7: GCal events with start_at < end_at spanning more than
    // one calendar day render as continuous bars across covered cells,
    // mirroring how multi-day tasks render. All-day events that span
    // `is_all_day` use [start_at, end_at] inclusive minus a day; timed
    // multi-day events use the same date span as tasks.
    for (const ev of calEventsAll) {
      if (!ev.start_at || !ev.end_at) continue;
      const startMs = startOfDay(new Date(ev.start_at)).getTime();
      // Google's all-day events use exclusive end (e.g. start=Mon, end=Wed
      // means Mon+Tue, not Mon+Tue+Wed). Subtract a day for those.
      const endRawMs = startOfDay(new Date(ev.end_at)).getTime();
      const endMs = ev.is_all_day ? endRawMs - 86400000 : endRawMs;
      if (endMs <= startMs) continue;
      if (startMs > lastMs || endMs < firstMs) continue;
      const clampedS = Math.max(startMs, firstMs);
      const clampedE = Math.min(endMs, lastMs);
      const startIdx = days.findIndex((d) => startOfDay(d).getTime() === clampedS);
      const endIdx = days.findIndex((d) => startOfDay(d).getTime() === clampedE);
      if (startIdx < 0 || endIdx < 0) continue;
      const startRow = Math.floor(startIdx / 7);
      const endRow = Math.floor(endIdx / 7);
      for (let row = startRow; row <= endRow; row++) {
        const rowStart = row * 7;
        const rowEnd = rowStart + 6;
        const segS = Math.max(startIdx, rowStart);
        const segE = Math.min(endIdx, rowEnd);
        out.push({
          kind: "event",
          event: ev,
          weekRow: row,
          startCol: segS - rowStart + 1,
          endCol: segE - rowStart + 1,
          isFirstSegment: row === startRow && startMs === clampedS,
          isLastSegment: row === endRow && endMs === clampedE,
          segDays: days.slice(segS, segE + 1),
          lane: 0,
        });
      }
    }
    // Assign lanes: per week-row, sort bars left-to-right, give each bar
    // the first lane (0..N) where no earlier bar in that lane overlaps
    // its column range. Stacks multiple bars vertically so they never
    // visually collide.
    out.sort((a, b) =>
      a.weekRow !== b.weekRow ? a.weekRow - b.weekRow : a.startCol - b.startCol
    );
    const rowLaneEnds = new Map<number, number[]>();
    for (const bar of out) {
      const ends = rowLaneEnds.get(bar.weekRow) ?? [];
      let lane = 0;
      while (lane < ends.length && ends[lane] >= bar.startCol) lane++;
      ends[lane] = bar.endCol;
      rowLaneEnds.set(bar.weekRow, ends);
      bar.lane = lane;
    }
    return out;
  }, [tasks, days]);

  // For each visible cell (by dateKey), how many bar lanes sit on top
  // of it. Cells use this to push their chip area down so chips never
  // render under the bar.
  const cellBarLanes = useMemo(() => {
    const m = new Map<string, number>();
    for (const bar of multiDayBars) {
      const lanesNeeded = bar.lane + 1;
      for (const d of bar.segDays) {
        const key = format(d, "yyyy-MM-dd");
        m.set(key, Math.max(m.get(key) ?? 0, lanesNeeded));
      }
    }
    return m;
  }, [multiDayBars]);

  // Hover state for the multi-day bars. Hovering anywhere on a bar
  // lights up EVERY cell the underlying task covers, not just the cell
  // the cursor is over — gives a strong visual cue of the task's span.
  const [hoveredBarTaskId, setHoveredBarTaskId] = useState<string | null>(null);
  const hoverHighlightKeys = useMemo(() => {
    const set = new Set<string>();
    if (!hoveredBarTaskId) return set;
    // Look in tasks first, then fall through to events.
    const t = tasks.find((x) => x.id === hoveredBarTaskId);
    let startAt: string | null = null;
    let endAt: string | null = null;
    let allDay = false;
    if (t?.start_at && t.due_at) {
      startAt = t.start_at;
      endAt = t.due_at;
    } else {
      const ev = calEventsAll.find((x) => x.id === hoveredBarTaskId);
      if (ev?.start_at && ev?.end_at) {
        startAt = ev.start_at;
        endAt = ev.end_at;
        allDay = !!ev.is_all_day;
      }
    }
    if (!startAt || !endAt) return set;
    const startMs = startOfDay(new Date(startAt)).getTime();
    // GCal all-day events have exclusive end, subtract 1 day
    const endMs = allDay
      ? startOfDay(new Date(endAt)).getTime() - 86400000
      : startOfDay(new Date(endAt)).getTime();
    for (let ms = startMs; ms <= endMs; ms += 86400000) {
      set.add(format(new Date(ms), "yyyy-MM-dd"));
    }
    return set;
  }, [hoveredBarTaskId, tasks, calEventsAll]);

  // While the user is dragging a task, track which cell their cursor is
  // over so we can light up the FULL range the bar would land on (not
  // just the cell under the cursor). For a 3-day task, three cells light
  // up; the offset preserves where in the bar the user grabbed from so
  // the highlight matches the eventual drop result.
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const dragHoverKeys = useMemo(() => {
    const set = new Set<string>();
    if (!activeId || !dragOverDateKey) return set;
    const idStr = String(activeId);
    let startMs: number | null = null;
    let endMs: number | null = null;
    let fromKey: string | undefined;
    if (idStr.startsWith("event::")) {
      const [, eventId, fk] = idStr.split("::");
      fromKey = fk;
      const ev = calEventsAll.find((x) => x.id === eventId);
      if (!ev?.start_at || !ev?.end_at) return set;
      startMs = startOfDay(new Date(ev.start_at)).getTime();
      const allDay = !!ev.is_all_day;
      endMs = allDay
        ? startOfDay(new Date(ev.end_at)).getTime() - 86400000
        : startOfDay(new Date(ev.end_at)).getTime();
    } else {
      const [taskId, fk] = idStr.split("::");
      fromKey = fk;
      const t = tasks.find((x) => x.id === taskId);
      if (!t?.start_at || !t?.due_at) return set;
      startMs = startOfDay(new Date(t.start_at)).getTime();
      endMs = startOfDay(new Date(t.due_at)).getTime();
    }
    const [oy, om, od] = dragOverDateKey.split("-").map(Number);
    const dropDay = new Date(oy, om - 1, od);
    let offsetMs: number;
    if (fromKey) {
      const [fy, fm, fd] = fromKey.split("-").map(Number);
      const fromDay = new Date(fy, fm - 1, fd);
      offsetMs = startOfDay(dropDay).getTime() - startOfDay(fromDay).getTime();
    } else {
      offsetMs = startOfDay(dropDay).getTime() - startMs;
    }
    const newStart = startMs + offsetMs;
    const newEnd = endMs + offsetMs;
    for (let ms = newStart; ms <= newEnd; ms += 86400000) {
      set.add(format(new Date(ms), "yyyy-MM-dd"));
    }
    return set;
  }, [activeId, dragOverDateKey, tasks, calEventsAll]);

  // Measure the cell width so the DragOverlay can render multi-day
  // tasks at their REAL bar width (cellWidth * duration) instead of a
  // generic chip. ResizeObserver keeps it accurate across viewport
  // resizes; gridRef points at the 7-col cell grid.
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [cellWidth, setCellWidth] = useState(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => setCellWidth(el.clientWidth / 7);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;

    // Round F v4.4: GCal event drag — drag id starts with "event::".
    // Shift start_at + end_at by the same day offset (gap-preserving)
    // and PATCH the Google event via /api/calendar/google/event/[id].
    const idStr = String(e.active.id);
    if (idStr.startsWith("event::")) {
      const [, eventId, fromKey] = idStr.split("::");
      const date = String(e.over.id);
      const ev = calEventsAll.find((x) => x.id === eventId);
      if (!ev || !ev.start_at) return;
      const [y, m, d] = date.split("-").map(Number);
      const dropDay = new Date(y, m - 1, d);
      let offsetDays: number;
      if (fromKey) {
        const [fy, fm, fd] = fromKey.split("-").map(Number);
        const fromDay = new Date(fy, fm - 1, fd);
        offsetDays = Math.round(
          (startOfDay(dropDay).getTime() - startOfDay(fromDay).getTime()) / 86400000
        );
      } else {
        offsetDays = Math.round(
          (startOfDay(dropDay).getTime() - startOfDay(new Date(ev.start_at)).getTime()) / 86400000
        );
      }
      if (offsetDays === 0) return;
      const newStart = new Date(ev.start_at);
      newStart.setDate(newStart.getDate() + offsetDays);
      const patch: { start_at: string; end_at?: string } = {
        start_at: newStart.toISOString(),
      };
      if (ev.end_at) {
        const newEnd = new Date(ev.end_at);
        newEnd.setDate(newEnd.getDate() + offsetDays);
        patch.end_at = newEnd.toISOString();
      }
      fetch(`/api/calendar/google/event/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      })
        .then((r) => {
          if (!r.ok) throw new Error(`http_${r.status}`);
          qc.invalidateQueries({ queryKey: ["calendarEvents"] });
        })
        .catch((err) => {
          toast.error("Couldn't reschedule event: " + (err?.message ?? "unknown"));
          qc.invalidateQueries({ queryKey: ["calendarEvents"] });
        });
      return;
    }

    // Drag id is "<taskId>::<from-day-yyyy-mm-dd>" — the second part
    // is the cell the chip was grabbed from. We always shift BOTH
    // start_at and due_at by the same offset so the relative span is
    // preserved (single-day stays single-day, 3-day stays 3-day).
    // Hours/minutes are kept verbatim.
    const [taskId, fromKey] = String(e.active.id).split("::");
    const date = String(e.over.id); // yyyy-mm-dd (drop target)
    const t = tasks.find((x) => x.id === taskId);
    if (!t || !t.due_at) return;
    const [y, m, d] = date.split("-").map(Number);
    const dropDay = new Date(y, m - 1, d);

    let offsetDays: number;
    if (fromKey) {
      const [fy, fm, fd] = fromKey.split("-").map(Number);
      const fromDay = new Date(fy, fm - 1, fd);
      offsetDays = Math.round(
        (startOfDay(dropDay).getTime() - startOfDay(fromDay).getTime()) / 86400000
      );
    } else {
      const origDue = new Date(t.due_at);
      offsetDays = Math.round(
        (startOfDay(dropDay).getTime() - startOfDay(origDue).getTime()) / 86400000
      );
    }
    if (offsetDays === 0) return; // dropped on same cell

    const origDue = new Date(t.due_at);
    const newDue = new Date(origDue);
    newDue.setDate(newDue.getDate() + offsetDays);
    const updateData: { id: string; due_at: string; start_at?: string } = {
      id: t.id,
      due_at: newDue.toISOString(),
    };
    if (t.start_at) {
      const newStart = new Date(t.start_at);
      newStart.setDate(newStart.getDate() + offsetDays);
      // Guard: never let start drift past due (start <= due always).
      if (newStart.getTime() <= newDue.getTime()) {
        updateData.start_at = newStart.toISOString();
      }
    }
    update.mutate(updateData);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight">{format(cursor, "MMMM yyyy", { locale: dfLocale })}</h1>
              {/* Two-way GCal sync indicator — gold pill matches /pricing carousel mockup */}
              <span className="editorial-number text-[10px] tracking-[0.18em] text-accent shrink-0">
                ↔ G&#8209;CAL
              </span>
            </div>
          <div className="flex">
            <button className="btn-ghost size-9 p-0 grid place-items-center" onClick={() => setCursor(subMonths(cursor, 1))}>
              <ChevronLeft className="size-4" />
            </button>
            <button className="btn-ghost h-9 px-2 text-xs" onClick={() => setCursor(new Date())}>{tr(lang, "view.calendar.today")}</button>
            <button className="btn-ghost size-9 p-0 grid place-items-center" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <button className="btn-ghost gap-2" onClick={() => setQuickAdd(true)}>
          <Plus className="size-4" /> {tr(lang, "shared.quickAdd")}
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="grid grid-cols-7 text-xs text-muted-fg uppercase tracking-wider px-1">
          {(["mon","tue","wed","thu","fri","sat","sun"] as const).map((d) => (
            <div key={d} className="px-2 py-2">{tr(lang, (`view.calendar.weekday.${d}`) as any)}</div>
          ))}
        </div>
        <DndContext
          sensors={sensors}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
          onDragOver={(e: DragOverEvent) => setDragOverDateKey(e.over ? String(e.over.id) : null)}
          onDragEnd={(e) => { setDragOverDateKey(null); onDragEnd(e); }}
          onDragCancel={() => { setActiveId(null); setDragOverDateKey(null); }}
        >
          <div ref={gridRef} className="flex-1 grid grid-cols-7 grid-rows-6 gap-px bg-border/15 overflow-auto relative">
            {days.map((d, i) => {
              const key = format(d, "yyyy-MM-dd");
              // Single-day tasks only — multi-day tasks render as a
              // single continuous bar overlay (below) so the user sees
              // ONE chip spanning all covered days, not duplicate per-
              // day chips.
              const dayMs = startOfDay(d).getTime();
              const dayTasks = tasks.filter((t) => {
                const anchor = t.due_at ?? t.start_at;
                if (!anchor) return false;
                const due = startOfDay(new Date(t.due_at ?? t.start_at!)).getTime();
                if (t.start_at) {
                  const start = startOfDay(new Date(t.start_at)).getTime();
                  if (start !== due) return false;
                }
                return due === dayMs;
              });
              return (
                <DayCell
                  key={key}
                  dateKey={key}
                  date={d}
                  inMonth={isSameMonth(d, monthStart)}
                  tasks={dayTasks}
                  events={eventsByDay.get(key) ?? []}
                  activeId={activeId}
                  onPickDay={onPickDay}
                  barLanesAbove={cellBarLanes.get(key) ?? 0}
                  barHoverHighlight={hoverHighlightKeys.has(key) || dragHoverKeys.has(key)}
                />
              );
            })}
            {/* Multi-day bar overlay: ONE bar per task per visible
                week-row segment, positioned via grid-column so it spans
                exactly the covered cells. pointer-events: none on the
                wrapper so the cells underneath stay clickable; only the
                inner draggable surface captures drag/click. */}
            {multiDayBars.map((bar, i) => {
              const itemId = bar.kind === "event" ? bar.event!.id : bar.task!.id;
              const dimmedPrefix = bar.kind === "event"
                ? `event::${itemId}::`
                : `${itemId}::`;
              return (
                <DraggableBar
                  key={`bar-${itemId}-${bar.weekRow}-${i}`}
                  bar={bar}
                  dimmed={activeId?.startsWith(dimmedPrefix) ?? false}
                  onPickDay={onPickDay}
                  onHoverChange={setHoveredBarTaskId}
                />
              );
            })}
          </div>
          <DragOverlay dropAnimation={{ duration: 150 }}>
            {activeItem && activeItem.kind === "task" ? (
              <DragPreview task={activeItem.task} cellWidth={cellWidth} />
            ) : activeItem && activeItem.kind === "event" ? (
              <EventDragPreview event={activeItem.event} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function DayCell({
  dateKey, date, inMonth, tasks, events, activeId, onPickDay,
  barLanesAbove, barHoverHighlight,
}: {
  dateKey: string;
  date: Date;
  inMonth: boolean;
  tasks: TaskWithTags[];
  events: CalendarEvent[];
  activeId: string | null;
  onPickDay: (d: Date) => void;
  // Number of multi-day bar lanes overlaying this cell. The chip area
  // is pushed down by this many * lane-height so chips never collide
  // with bars.
  barLanesAbove: number;
  // True when a multi-day bar covering this cell is being hovered —
  // every cell in that bar's range gets the same highlight.
  barHoverHighlight: boolean;
}) {
  const lang = useLanguage();
  const dfLocale = getLanguage(lang).dateFnsLocale;
  const { isOver, setNodeRef } = useDroppable({ id: dateKey });
  const today = isSameDay(date, new Date());
  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        // Open day view if user clicked the cell itself, not a child
        // (drag handles, task chips). Tasks have stopPropagation in
        // DraggableTask so this fires for the empty area / date number.
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.dayCellHit === "1") {
          onPickDay(date);
        }
      }}
      className={cn(
        "p-1.5 min-h-[112px] flex flex-col gap-1 transition-colors cursor-pointer",
        inMonth ? "bg-bg/15" : "bg-transparent opacity-60",
        isOver && "bg-muted/60",
        // Same strength as isOver so every cell in a dragged multi-day
        // task's range lights up uniformly, not just the cell directly
        // under the cursor.
        barHoverHighlight && "bg-muted/60",
        "hover:bg-muted/30"
      )}
    >
      <div className="flex items-center justify-between text-xs" data-day-cell-hit="1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPickDay(date); }}
          aria-label={tr(lang, "view.calendar.openDay").replace("{date}", format(date, "EEEE, MMMM d", { locale: dfLocale }))}
          className={cn(
            "size-6 grid place-items-center rounded-full transition-colors",
            today
              ? "bg-accent text-accent-fg font-semibold"
              : "text-muted-fg hover:bg-muted hover:text-fg"
          )}
        >
          {format(date, "d")}
        </button>
      </div>
      <div
        className="flex-1 flex flex-col gap-1 overflow-hidden"
        style={barLanesAbove > 0 ? { marginTop: `${barLanesAbove * 22}px` } : undefined}
        data-day-cell-hit="1"
      >
        {events.slice(0, 2).map((ev) => (
          <DraggableEventChip
            key={`ev-${ev.id}`}
            event={ev}
            lang={lang}
            size="compact"
            fromKey={dateKey}
          />
        ))}
        {events.length > 2 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPickDay(date); }}
            className="text-[10px] text-muted-fg pl-1 hover:text-fg text-left"
          >
            + {events.length - 2}
          </button>
        )}
        {tasks.slice(0, 4).map((t) => (
          <DraggableTask
            key={t.id}
            task={t}
            dayKey={dateKey}
            dimmed={activeId === `${t.id}::${dateKey}`}
          />
        ))}
        {tasks.length > 4 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPickDay(date); }}
            className="text-[10px] text-muted-fg pl-1 hover:text-fg text-left"
          >
            + {tasks.length - 4} more
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * One continuous bar overlay for a multi-day task — sits in the same
 * 7×6 grid as the day cells via grid-row/grid-column, so it spans the
 * exact cells the task covers (e.g. start_at=5/5, due_at=5/7 → cols
 * 1-3 of the matching week-row). Wraps a transparent positioner so
 * cells underneath the bar's margin stay click-through; only the
 * inner colored chip captures the drag.
 */
function DraggableBar({
  bar,
  dimmed,
  onPickDay,
  onHoverChange,
}: {
  bar: {
    kind: "task" | "event";
    task?: TaskWithTags;
    event?: CalendarEvent;
    weekRow: number;
    startCol: number;
    endCol: number;
    isFirstSegment: boolean;
    isLastSegment: boolean;
    segDays: Date[];
    lane: number;
  };
  dimmed?: boolean;
  onPickDay: (d: Date) => void;
  onHoverChange: (id: string | null) => void;
}) {
  // Round F v4.7: bars now render either a task OR a Google Calendar event.
  // The drag id, anchor day, and visual treatment branch on bar.kind.
  const isEvent = bar.kind === "event";
  const item = isEvent ? bar.event! : bar.task!;
  const itemId = item.id;
  const anchorIso = isEvent
    ? new Date(bar.event!.start_at!).toISOString()
    : new Date(bar.task!.start_at!).toISOString();
  const anchorYmd = format(new Date(anchorIso), "yyyy-MM-dd");
  const dragId = isEvent
    ? `event::${itemId}::${anchorYmd}`
    : `${itemId}::${anchorYmd}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId });
  const setSelected = useUIStore((s) => s.setSelectedTaskId);

  const [editingEvent, setEditingEvent] = useState(false);

  function handleBarClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (isEvent) {
      // Events open the shared edit dialog.
      setEditingEvent(true);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const n = bar.segDays.length;
    if (n <= 0 || rect.width <= 0) return;
    const rel = e.clientX - rect.left;
    const idx = Math.min(n - 1, Math.max(0, Math.floor((rel / rect.width) * n)));
    onPickDay(bar.segDays[idx]);
  }

  const numCols = bar.endCol - bar.startCol + 1;
  const leftPadPx = bar.isFirstSegment ? 6 : 0;
  const rightPadPx = bar.isLastSegment ? 6 : 0;
  const LANE_HEIGHT = 22;
  const LANE_TOP_OFFSET = 26;

  const title = isEvent
    ? bar.event!.title?.trim() || "Untitled event"
    : bar.task!.title;
  const completed = !isEvent && !!bar.task!.is_completed;
  const bgClass = isEvent
    ? "bg-sky-500/55 hover:bg-sky-500/70 text-fg"
    : priorityBg(bar.task!.priority);

  return (
    <div
      style={{
        position: "absolute",
        top: `calc(${(bar.weekRow * 100) / 6}% + ${LANE_TOP_OFFSET + bar.lane * LANE_HEIGHT}px)`,
        left: `calc(${((bar.startCol - 1) * 100) / 7}% + ${leftPadPx}px)`,
        width: `calc(${(numCols * 100) / 7}% - ${leftPadPx + rightPadPx}px)`,
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={handleBarClick}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!isEvent) setSelected(bar.task!.id);
          else setEditingEvent(true);
        }}
        onMouseEnter={() => onHoverChange(itemId)}
        onMouseLeave={() => onHoverChange(null)}
        title={title}
        className={cn(
          "px-1.5 py-1 text-[11px] truncate cursor-grab active:cursor-grabbing pointer-events-auto",
          bgClass,
          completed && "line-through opacity-60",
          bar.isFirstSegment && bar.isLastSegment && "rounded",
          bar.isFirstSegment && !bar.isLastSegment && "rounded-l",
          !bar.isFirstSegment && bar.isLastSegment && "rounded-r",
          (dimmed || isDragging) && "opacity-30"
        )}
      >
        {bar.isFirstSegment ? title : " "}
      </div>
      {isEvent && editingEvent && (
        <EventEditDialog
          event={bar.event!}
          lang={"en"}
          onClose={() => setEditingEvent(false)}
        />
      )}
    </div>
  );
}

function DraggableTask({
  task,
  dayKey,
  dimmed,
}: {
  task: TaskWithTags;
  // The calendar cell this chip lives in. Encoded into the drag id so
  // the drop handler can shift a multi-day range by exactly the gap
  // between source-day and drop-day, instead of pinning the new start
  // to the drop target.
  dayKey: string;
  dimmed?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${task.id}::${dayKey}`,
  });
  const setSelected = useUIStore((s) => s.setSelectedTaskId);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => { e.stopPropagation(); setSelected(task.id); }}
      className={cn(
        "px-1.5 py-1 rounded text-[11px] truncate cursor-grab active:cursor-grabbing",
        priorityBg(task.priority),
        task.is_completed && "line-through opacity-60",
        (dimmed || isDragging) && "opacity-30"
      )}
    >
      {task.title}
    </div>
  );
}

function DragPreview({ task, cellWidth }: { task: TaskWithTags; cellWidth: number }) {
  // Multi-day tasks render the preview at their REAL width — cellWidth
  // multiplied by the task's day-span — so the user sees a full-size
  // bar tracking the cursor instead of a single-day chip.
  let widthPx = 180;
  if (task.start_at && task.due_at && cellWidth > 0) {
    const s = startOfDay(new Date(task.start_at)).getTime();
    const e = startOfDay(new Date(task.due_at)).getTime();
    if (e > s) {
      const days = Math.round((e - s) / 86400000) + 1;
      widthPx = Math.max(80, cellWidth * days - 12);
    }
  }
  return (
    <div
      style={{ width: `${widthPx}px` }}
      className={cn(
        "px-2 py-1 rounded text-xs truncate shadow-2xl ring-2 ring-accent",
        priorityBg(task.priority)
      )}
    >
      {task.title}
    </div>
  );
}

/**
 * Round F v4.6: drag preview for GCal event chips on the month grid.
 * Mirrors DragPreview's chip shape (single-day style — events on the
 * grid render as single-day chips even when they span multiple days,
 * since multi-day bar rendering for events isn't implemented yet).
 */
function EventDragPreview({ event }: { event: CalendarEvent }) {
  const title = event.title?.trim() || "Untitled event";
  return (
    <div
      style={{ width: "180px" }}
      className={cn(
        "px-2 py-1 rounded text-xs truncate shadow-2xl ring-2 ring-accent",
        "bg-sky-500/55 text-fg"
      )}
    >
      {title}
    </div>
  );
}

function priorityBg(priority: number) {
  // Saturated chip backgrounds that read clearly on the translucent
  // calendar grid in both light and dark themes.
  if (priority >= 5) return "bg-p-high/70 text-fg";
  if (priority >= 3) return "bg-p-med/70 text-fg";
  if (priority >= 1) return "bg-p-low/70 text-fg";
  return "bg-muted text-fg";
}

/* ------------------------ Day view ------------------------ */

function DayView({
  date,
  onChangeDate,
  onBack,
}: {
  date: Date;
  onChangeDate: (d: Date) => void;
  onBack: () => void;
}) {
  const lang = useLanguage();
  const dfLocale = getLanguage(lang).dateFnsLocale;
  const { data: tasks = [] } = useTasks({ view: "all", includeCompleted: true });

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const { data: dayEvents = [] } = useCalendarEvents({ from: dayStart, to: dayEnd });
  const dayTasks = tasks
    .filter((t) => {
      const anchor = t.due_at ?? t.start_at;
      if (!anchor) return false;
      const due = new Date(t.due_at ?? t.start_at!);
      // For multi-day tasks, treat the task as active on every day its
      // [start_at, due_at] interval overlaps — not only the due day.
      const start = t.start_at ? new Date(t.start_at) : due;
      return start <= dayEnd && due >= dayStart;
    })
    .sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      const aAnchor = a.due_at ?? a.start_at;
      const ad = aAnchor ? new Date(aAnchor).getTime() : 0;
      const bAnchor = b.due_at ?? b.start_at;
      const bd = bAnchor ? new Date(bAnchor).getTime() : 0;
      if (a.is_all_day && !b.is_all_day) return -1;
      if (!a.is_all_day && b.is_all_day) return 1;
      return ad - bd;
    });

  const incomplete = dayTasks.filter((t) => !t.is_completed);
  const completed = dayTasks.filter((t) => t.is_completed);
  const isToday = isSameDay(date, new Date());

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-muted-fg hover:text-fg inline-flex items-center gap-1 mb-1"
            >
              <ArrowLeft className="size-3" />
              {format(date, "MMMM yyyy", { locale: dfLocale })}
            </button>
            <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight truncate">
              {isToday ? tr(lang, "view.calendar.today") : format(date, "EEEE", { locale: dfLocale })}
            </h1>
            <p className="text-sm text-muted-fg mt-1">
              {format(date, "MMMM d, yyyy", { locale: dfLocale })}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              className="btn-ghost size-9 p-0 grid place-items-center"
              onClick={() => onChangeDate(addDays(date, -1))}
              aria-label={tr(lang, "view.calendar.aria.prevDay")}
              title={tr(lang, "view.calendar.aria.prevDay")}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              className="btn-ghost h-9 px-2 text-xs"
              onClick={() => onChangeDate(new Date())}
            >
              {tr(lang, "view.calendar.today")}
            </button>
            <button
              className="btn-ghost size-9 p-0 grid place-items-center"
              onClick={() => onChangeDate(addDays(date, 1))}
              aria-label={tr(lang, "view.calendar.aria.nextDay")}
              title={tr(lang, "view.calendar.aria.nextDay")}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 md:px-3 py-3 space-y-3">
        <InlineTaskInput
          defaultProjectId={null}
          defaultDueAt={dayStart.toISOString()}
        />

        {/* Round F v4.7: events render as EventTaskRow rows interleaved
            with tasks, sorted chronologically — same UX as Today list view. */}
        {(() => {
          type Row =
            | { kind: "task"; sortAt: number; task: TaskWithTags }
            | { kind: "event"; sortAt: number; event: CalendarEvent };
          const rows: Row[] = [
            ...incomplete.map((t) => ({
              kind: "task" as const,
              sortAt: t.due_at
                ? new Date(t.due_at).getTime()
                : Number.POSITIVE_INFINITY,
              task: t,
            })),
            ...dayEvents.map((ev) => ({
              kind: "event" as const,
              sortAt: ev.start_at
                ? new Date(ev.start_at).getTime()
                : Number.POSITIVE_INFINITY,
              event: ev,
            })),
          ];
          rows.sort((a, b) => a.sortAt - b.sortAt);
          if (rows.length === 0) {
            return (
              <div className="px-3 py-12 text-center text-muted-fg">
                <div className="text-3xl mb-2 font-display"><em>{"—"}</em></div>
                <p className="text-sm">{tr(lang, "view.calendar.nothingScheduled")}</p>
              </div>
            );
          }
          return (
            <div className="space-y-1">
              {rows.map((r) =>
                r.kind === "task" ? (
                  <TaskItem key={r.task.id} task={r.task} />
                ) : (
                  <EventTaskRow key={`ev-${r.event.id}`} event={r.event} lang={lang} />
                )
              )}
            </div>
          );
        })()}

        {completed.length > 0 && (
          <div className="pt-4">
            <p className="px-3 text-xs text-muted-fg mb-1">
              {tr(lang, "view.calendar.completedCount").replace("{n}", String(completed.length))}
            </p>
            {completed.map((t) => (
              <TaskItem key={t.id} task={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
