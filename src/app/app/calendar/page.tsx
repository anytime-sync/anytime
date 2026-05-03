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
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { TaskItem } from "@/components/app/task-item";
import { InlineTaskInput } from "@/components/app/inline-task-input";

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
  const update = useUpdateTask();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  // The active drag's source day — encoded in the draggable id so
  // multi-day chips know which of their covered days the user grabbed
  // from. Format: "<taskId>::<yyyy-mm-dd>".
  const activeTask = useMemo(() => {
    if (!activeId) return null;
    const taskId = activeId.split("::")[0];
    return tasks.find((t) => t.id === taskId) ?? null;
  }, [activeId, tasks]);

  // Multi-day bars: one segment per visible week-row, positioned via
  // CSS grid-column so the bar overlays exactly the covered cells.
  // Re-uses the same 7×6 grid the cells live in; cells stay click-
  // through because the bar is rendered above with pointer-events
  // routed only at its draggable inner element.
  const multiDayBars = useMemo(() => {
    type Bar = {
      task: TaskWithTags;
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
    const t = tasks.find((x) => x.id === hoveredBarTaskId);
    if (!t?.start_at || !t?.due_at) return set;
    const s = startOfDay(new Date(t.start_at));
    const e = startOfDay(new Date(t.due_at));
    for (let d = new Date(s); d.getTime() <= e.getTime(); d = addDays(d, 1)) {
      set.add(format(d, "yyyy-MM-dd"));
    }
    return set;
  }, [hoveredBarTaskId, tasks]);

  // While the user is dragging a task, track which cell their cursor is
  // over so we can light up the FULL range the bar would land on (not
  // just the cell under the cursor). For a 3-day task, three cells light
  // up; the offset preserves where in the bar the user grabbed from so
  // the highlight matches the eventual drop result.
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const dragHoverKeys = useMemo(() => {
    const set = new Set<string>();
    if (!activeId || !dragOverDateKey) return set;
    const [taskId, fromKey] = activeId.split("::");
    const t = tasks.find((x) => x.id === taskId);
    if (!t?.start_at || !t?.due_at) return set;
    const s = startOfDay(new Date(t.start_at)).getTime();
    const e = startOfDay(new Date(t.due_at)).getTime();
    const [oy, om, od] = dragOverDateKey.split("-").map(Number);
    const dropDay = new Date(oy, om - 1, od);
    let offsetMs: number;
    if (fromKey) {
      const [fy, fm, fd] = fromKey.split("-").map(Number);
      const fromDay = new Date(fy, fm - 1, fd);
      offsetMs = startOfDay(dropDay).getTime() - startOfDay(fromDay).getTime();
    } else {
      offsetMs = startOfDay(dropDay).getTime() - s;
    }
    const newStart = s + offsetMs;
    const newEnd = e + offsetMs;
    for (let ms = newStart; ms <= newEnd; ms += 86400000) {
      set.add(format(new Date(ms), "yyyy-MM-dd"));
    }
    return set;
  }, [activeId, dragOverDateKey, tasks]);

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
    // Drag id is "<taskId>::<from-day-yyyy-mm-dd>" — the second part
    // is the cell the chip was dragged from, so multi-day chips can
    // shift the whole range by exactly the displaced number of days
    // instead of pinning the new start to the drop target.
    const [taskId, fromKey] = String(e.active.id).split("::");
    const date = String(e.over.id); // yyyy-mm-dd (drop target)
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    const [y, m, d] = date.split("-").map(Number);
    const dropDay = new Date(y, m - 1, d);

    // Multi-day task: shift both ends by (dropDay - fromDay) so a
    // 5/4–5/6 chip dragged from its 5/5 cell to 5/10 lands as 5/9–5/11
    // (preserves the original 3-day span).
    if (
      t.start_at &&
      t.due_at &&
      !isSameDay(new Date(t.start_at), new Date(t.due_at))
    ) {
      const origStart = new Date(t.start_at);
      const origEnd = new Date(t.due_at);
      let offsetDays: number;
      if (fromKey) {
        const [fy, fm, fd] = fromKey.split("-").map(Number);
        const fromDay = new Date(fy, fm - 1, fd);
        offsetDays = Math.round(
          (startOfDay(dropDay).getTime() - startOfDay(fromDay).getTime()) / 86400000
        );
      } else {
        // Fallback: anchor drop to the original start day.
        offsetDays = Math.round(
          (startOfDay(dropDay).getTime() - startOfDay(origStart).getTime()) / 86400000
        );
      }
      const newStart = new Date(origStart);
      newStart.setDate(newStart.getDate() + offsetDays);
      const newEnd = new Date(origEnd);
      newEnd.setDate(newEnd.getDate() + offsetDays);
      update.mutate({
        id: t.id,
        start_at: newStart.toISOString(),
        due_at: newEnd.toISOString(),
      });
      return;
    }

    const orig = t.due_at ? new Date(t.due_at) : new Date();
    const newDate = new Date(y, m - 1, d, t.is_all_day ? 0 : orig.getHours(), t.is_all_day ? 0 : orig.getMinutes());
    update.mutate({ id: t.id, due_at: newDate.toISOString() });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight">{format(cursor, "MMMM yyyy")}</h1>
          <div className="flex">
            <button className="btn-ghost size-9 p-0 grid place-items-center" onClick={() => setCursor(subMonths(cursor, 1))}>
              <ChevronLeft className="size-4" />
            </button>
            <button className="btn-ghost h-9 px-2 text-xs" onClick={() => setCursor(new Date())}>Today</button>
            <button className="btn-ghost size-9 p-0 grid place-items-center" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <button className="btn-ghost gap-2" onClick={() => setQuickAdd(true)}>
          <Plus className="size-4" /> Quick add
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="grid grid-cols-7 text-xs text-muted-fg uppercase tracking-wider px-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-2 py-2">{d}</div>
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
                if (!t.due_at) return false;
                const due = startOfDay(new Date(t.due_at)).getTime();
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
            {multiDayBars.map((bar, i) => (
              <DraggableBar
                key={`bar-${bar.task.id}-${bar.weekRow}-${i}`}
                bar={bar}
                dimmed={activeId?.startsWith(`${bar.task.id}::`) ?? false}
                onPickDay={onPickDay}
                onHoverChange={setHoveredBarTaskId}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 150 }}>
            {activeTask ? <DragPreview task={activeTask} cellWidth={cellWidth} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function DayCell({
  dateKey, date, inMonth, tasks, activeId, onPickDay,
  barLanesAbove, barHoverHighlight,
}: {
  dateKey: string;
  date: Date;
  inMonth: boolean;
  tasks: TaskWithTags[];
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
        barHoverHighlight && "bg-muted/30",
        "hover:bg-muted/30"
      )}
    >
      <div className="flex items-center justify-between text-xs" data-day-cell-hit="1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPickDay(date); }}
          aria-label={`Open ${format(date, "EEEE, MMMM d")}`}
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
    task: TaskWithTags;
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
  // Notify parent which task is being hovered so it can highlight all
  // cells covered by the same task (across week-rows).
  onHoverChange: (taskId: string | null) => void;
}) {
  const dragId = `${bar.task.id}::${format(
    // Anchor multi-day drag to the bar's leftmost visible day so the
    // common onDragEnd shift-by-(drop − from) math lines up.
    new Date(bar.task.start_at!),
    "yyyy-MM-dd"
  )}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId });
  const setSelected = useUIStore((s) => s.setSelectedTaskId);
  // A click on the bar should behave like clicking the cell underneath
  // it: open the day view for that specific day. We compute which of
  // the bar's covered days the user clicked on by mapping the click X
  // to a column within the bar's bounding box.
  function handleBarClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const n = bar.segDays.length;
    if (n <= 0 || rect.width <= 0) return;
    const rel = e.clientX - rect.left;
    const idx = Math.min(n - 1, Math.max(0, Math.floor((rel / rect.width) * n)));
    onPickDay(bar.segDays[idx]);
  }
  // Absolute-positioned overlay sitting on top of the cell grid. The
  // bar takes ZERO grid space, so cells underneath retain their normal
  // height and styling. left/width derive from start/end columns as
  // percentages of the 7-col grid; top stacks bars by lane so multiple
  // multi-day tasks in the same week-row never overlap.
  const numCols = bar.endCol - bar.startCol + 1;
  const leftPadPx = bar.isFirstSegment ? 6 : 0;
  const rightPadPx = bar.isLastSegment ? 6 : 0;
  const LANE_HEIGHT = 22;
  const LANE_TOP_OFFSET = 26; // clears the date number row
  return (
    <div
      style={{
        position: "absolute",
        top: `calc(${(bar.weekRow * 100) / 6}% + ${LANE_TOP_OFFSET + bar.lane * LANE_HEIGHT}px)`,
        left: `calc(${((bar.startCol - 1) * 100) / 7}% + ${leftPadPx}px)`,
        width: `calc(${(numCols * 100) / 7}% - ${leftPadPx + rightPadPx}px)`,
        // Wrapper has no pointer events; the inner chip re-enables
        // them so cells around the chip stay clickable.
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={handleBarClick}
        onDoubleClick={(e) => { e.stopPropagation(); setSelected(bar.task.id); }}
        onMouseEnter={() => onHoverChange(bar.task.id)}
        onMouseLeave={() => onHoverChange(null)}
        title={bar.task.title}
        className={cn(
          "px-1.5 py-1 text-[11px] truncate cursor-grab active:cursor-grabbing pointer-events-auto",
          priorityBg(bar.task.priority),
          bar.task.is_completed && "line-through opacity-60",
          bar.isFirstSegment && bar.isLastSegment && "rounded",
          bar.isFirstSegment && !bar.isLastSegment && "rounded-l",
          !bar.isFirstSegment && bar.isLastSegment && "rounded-r",
          (dimmed || isDragging) && "opacity-30"
        )}
      >
        {bar.isFirstSegment ? bar.task.title : " "}
      </div>
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
  const { data: tasks = [] } = useTasks({ view: "all", includeCompleted: true });

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const dayTasks = tasks
    .filter((t) => t.due_at && new Date(t.due_at) >= dayStart && new Date(t.due_at) <= dayEnd)
    .sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      const ad = a.due_at ? new Date(a.due_at).getTime() : 0;
      const bd = b.due_at ? new Date(b.due_at).getTime() : 0;
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
              {format(date, "MMMM yyyy")}
            </button>
            <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight truncate">
              {isToday ? "Today" : format(date, "EEEE")}
            </h1>
            <p className="text-sm text-muted-fg mt-1">
              {format(date, "MMMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              className="btn-ghost size-9 p-0 grid place-items-center"
              onClick={() => onChangeDate(addDays(date, -1))}
              aria-label="Previous day"
              title="Previous day"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              className="btn-ghost h-9 px-2 text-xs"
              onClick={() => onChangeDate(new Date())}
            >
              Today
            </button>
            <button
              className="btn-ghost size-9 p-0 grid place-items-center"
              onClick={() => onChangeDate(addDays(date, 1))}
              aria-label="Next day"
              title="Next day"
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

        {dayTasks.length === 0 ? (
          <div className="px-3 py-12 text-center text-muted-fg">
            <div className="text-3xl mb-2 font-display"><em>{"—"}</em></div>
            <p className="text-sm">Nothing scheduled for this day.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {incomplete.map((t) => (
              <TaskItem key={t.id} task={t} />
            ))}
          </div>
        )}

        {completed.length > 0 && (
          <div className="pt-4">
            <p className="px-3 text-xs text-muted-fg mb-1">
              Completed &middot; {completed.length}
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
