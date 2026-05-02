"use client";

import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, startOfDay, endOfDay, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { useMemo, useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Plus, ArrowLeft } from "lucide-react";
import { useTasks, useUpdateTask, type TaskWithTags } from "@/hooks/use-tasks";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";
import { TaskItem } from "@/components/app/task-item";
import { InlineTaskInput } from "@/components/app/inline-task-input";

/**
 * Calendar ÃÂ¢ÃÂÃÂ month grid with click-through to single-day view.
 *
 * Two modes, switched by `mode` state:
 *   - "month": classic 7ÃÂÃÂ6 grid, drag tasks across days, see at-a-glance
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
  const [dragBarRect, setDragBarRect] = useState<{ width: number; height: number } | null>(null);
  const activeTaskId = activeId?.startsWith("bar:") ? activeId.split(":")[1] : activeId;
  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) ?? null : null;

  // Multi-day bars: tasks whose start_at and due_at land on different
  // calendar days render as a single horizontal bar that overlays and
  // spans the relevant date cells (iOS-style). One segment per week row,
  // greedy lane-packed so parallel ranges stack without overlapping.
  const { multiDayBars, cellLanes } = useMemo(() => {
    type Bar = {
      task: TaskWithTags;
      weekRow: number;
      startCol: number; // 1-indexed grid col
      endCol: number;
      isFirstSegment: boolean;
      isLastSegment: boolean;
      lane: number;
    };
    const bars: Bar[] = [];
    if (days.length === 0) return { multiDayBars: bars, cellLanes: [] as number[] };

    const firstDay = startOfDay(days[0]).getTime();
    const lastDay = startOfDay(days[days.length - 1]).getTime();

    for (const t of tasks) {
      if (!t.start_at || !t.due_at) continue;
      const s = startOfDay(new Date(t.start_at)).getTime();
      const e = startOfDay(new Date(t.due_at)).getTime();
      if (s === e) continue; // single-day ÃÂ¢ÃÂÃÂ rendered in its cell
      if (s > lastDay || e < firstDay) continue; // outside visible grid

      const clampedStart = Math.max(s, firstDay);
      const clampedEnd = Math.min(e, lastDay);
      const startIdx = days.findIndex(
        (d) => startOfDay(d).getTime() === clampedStart
      );
      const endIdx = days.findIndex(
        (d) => startOfDay(d).getTime() === clampedEnd
      );
      if (startIdx < 0 || endIdx < 0) continue;
      const isFirst = s === clampedStart;
      const isLast = e === clampedEnd;

      const startRow = Math.floor(startIdx / 7);
      const endRow = Math.floor(endIdx / 7);
      for (let row = startRow; row <= endRow; row++) {
        const rowStart = row * 7;
        const rowEnd = rowStart + 6;
        const segStart = Math.max(startIdx, rowStart);
        const segEnd = Math.min(endIdx, rowEnd);
        bars.push({
          task: t,
          weekRow: row,
          startCol: segStart - rowStart + 1,
          endCol: segEnd - rowStart + 1,
          isFirstSegment: row === startRow && isFirst,
          isLastSegment: row === endRow && isLast,
          lane: 0,
        });
      }
    }

    // Greedy lane assignment per week row
    for (let row = 0; row < 6; row++) {
      const segs = bars
        .filter((b) => b.weekRow === row)
        .sort((a, b) => a.startCol - b.startCol);
      const lanes: { startCol: number; endCol: number }[][] = [];
      for (const seg of segs) {
        let lane = 0;
        while (
          lanes[lane]?.some(
            (s) => !(seg.endCol < s.startCol || seg.startCol > s.endCol)
          )
        ) {
          lane++;
        }
        seg.lane = lane;
        if (!lanes[lane]) lanes[lane] = [];
        lanes[lane].push({ startCol: seg.startCol, endCol: seg.endCol });
      }
    }

    // For each cell index, the number of bar lanes occupying it ÃÂ¢ÃÂÃÂ so the
    // cell can reserve vertical space above its single-day task chips.
    const cellLanes: number[] = new Array(days.length).fill(0);
    for (const bar of bars) {
      const rowStart = bar.weekRow * 7;
      for (let c = bar.startCol - 1; c <= bar.endCol - 1; c++) {
        cellLanes[rowStart + c] = Math.max(cellLanes[rowStart + c], bar.lane + 1);
      }
    }

    return { multiDayBars: bars, cellLanes };
  }, [tasks, days]);

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const aid = String(e.active.id);
    const taskId = aid.startsWith("bar:") ? aid.split(":")[1] : aid;
    const date = String(e.over.id); // yyyy-mm-dd
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    const [y, m, d] = date.split("-").map(Number);
    // Multi-day: preserve duration. Drop date becomes new start; due_at shifts by same offset.
    if (t.start_at && t.due_at) {
      const sDay = startOfDay(new Date(t.start_at));
      const dDay = startOfDay(new Date(t.due_at));
      if (sDay.getTime() !== dDay.getTime()) {
        const origStart = new Date(t.start_at);
        const origDue = new Date(t.due_at);
        const durationMs = dDay.getTime() - sDay.getTime();
        const newStart = new Date(
          y, m - 1, d,
          t.is_all_day ? 0 : origStart.getHours(),
          t.is_all_day ? 0 : origStart.getMinutes()
        );
        const newDue = new Date(newStart.getTime() + durationMs);
        if (!t.is_all_day) {
          newDue.setHours(origDue.getHours(), origDue.getMinutes());
        }
        update.mutate({
          id: t.id,
          start_at: newStart.toISOString(),
          due_at: newDue.toISOString(),
        });
        return;
      }
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
          onDragStart={(e: DragStartEvent) => {
            const aid = String(e.active.id);
            setActiveId(aid);
            if (aid.startsWith("bar:")) {
              const el = document.querySelector(`[data-bar-id="${aid}"]`);
              if (el) {
                const r = el.getBoundingClientRect();
                setDragBarRect({ width: r.width, height: r.height });
              }
            } else {
              setDragBarRect(null);
            }
          }}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-px bg-border overflow-auto relative">
            {days.map((d, i) => {
              const key = format(d, "yyyy-MM-dd");
              // Single-day tasks only ÃÂ¢ÃÂÃÂ multi-day tasks become overlay
              // bars rendered as siblings below.
              const dayTasks = tasks.filter((t) => {
                if (!t.due_at) return false;
                if (!isSameDay(new Date(t.due_at), d)) return false;
                if (
                  t.start_at &&
                  !isSameDay(new Date(t.start_at), new Date(t.due_at))
                ) {
                  return false;
                }
                return true;
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
                  reservedLanes={cellLanes[i] ?? 0}
                  style={{ gridRow: Math.floor(i / 7) + 1, gridColumn: (i % 7) + 1 }}
                />
              );
            })}
            {multiDayBars.map((bar, i) => (
              <DraggableBar
                key={`bar-${bar.task.id}-${bar.weekRow}-${i}`}
                bar={bar}
                dimmed={activeId === `bar:${bar.task.id}:${bar.weekRow}`}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 150 }}>
            {activeTask ? (
              activeId?.startsWith("bar:") && dragBarRect ? (
                <MultiDayBarPreview task={activeTask} width={dragBarRect.width} />
              ) : (
                <DragPreview task={activeTask} />
              )
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function DayCell({
  dateKey, date, inMonth, tasks, activeId, onPickDay, reservedLanes, style,
}: {
  dateKey: string;
  date: Date;
  inMonth: boolean;
  tasks: TaskWithTags[];
  activeId: string | null;
  onPickDay: (d: Date) => void;
  reservedLanes: number;
  style?: React.CSSProperties;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dateKey });
  const today = isSameDay(date, new Date());
  // Reserve vertical room above task chips for any multi-day bars
  // passing through this cell (each lane = 22px).
  const reservedHeight = reservedLanes * 22;
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        // Open day view if user clicked the cell itself, not a child
        // (drag handles, task chips). Tasks have stopPropagation in
        // DraggableTask so this fires for the empty area / date number.
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.dayCellHit === "1") {
          onPickDay(date);
        }
      }}
      className={cn(
        "bg-bg p-1.5 min-h-[112px] flex flex-col gap-1 transition-colors cursor-pointer",
        !inMonth && "opacity-50",
        isOver && "bg-muted",
        "hover:bg-muted/40"
      )}
    >
      <div className="relative z-10 flex items-center justify-between text-xs" data-day-cell-hit="1">
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
      {reservedHeight > 0 && (
        <div
          aria-hidden
          style={{ height: reservedHeight }}
          data-day-cell-hit="1"
        />
      )}
      <div className="flex-1 flex flex-col gap-1 overflow-hidden" data-day-cell-hit="1">
        {tasks.slice(0, 4).map((t) => (
          <DraggableTask key={t.id} task={t} dimmed={activeId === t.id} />
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

function DraggableTask({ task, dimmed }: { task: TaskWithTags; dimmed?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
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

function DragPreview({ task }: { task: TaskWithTags }) {
  return (
    <div className={cn(
      "px-2 py-1 rounded text-xs truncate shadow-2xl ring-2 ring-accent w-[180px]",
      priorityBg(task.priority)
    )}>
      {task.title}
    </div>
  );
}

type MultiDayBar = {
  task: TaskWithTags;
  weekRow: number;
  startCol: number;
  endCol: number;
  isFirstSegment: boolean;
  isLastSegment: boolean;
  lane: number;
};

function DraggableBar({ bar, dimmed }: { bar: MultiDayBar; dimmed?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `bar:${bar.task.id}:${bar.weekRow}`,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-bar-id={`bar:${bar.task.id}:${bar.weekRow}`}
      style={{
        gridRow: bar.weekRow + 1,
        gridColumn: `${bar.startCol} / ${bar.endCol + 1}`,
        marginTop: `${36 + bar.lane * 22}px`,
        marginLeft: bar.isFirstSegment ? "6px" : "0px",
        marginRight: bar.isLastSegment ? "6px" : "0px",
        alignSelf: "start",
        zIndex: 5,
      }}
      className={cn(
        "h-5 px-2 text-[11px] truncate cursor-grab active:cursor-grabbing leading-5 flex items-center font-medium",
        "bg-accent/20 text-accent-fg ring-1 ring-accent/40",
        bar.task.is_completed && "line-through opacity-60",
        (dimmed || isDragging) && "opacity-30",
        bar.isFirstSegment && bar.isLastSegment && "rounded",
        bar.isFirstSegment && !bar.isLastSegment && "rounded-l",
        !bar.isFirstSegment && bar.isLastSegment && "rounded-r"
      )}
      title={bar.task.title}
    >
      {bar.isFirstSegment ? bar.task.title : ""}
    </div>
  );
}

function MultiDayBarPreview({ task, width }: { task: TaskWithTags; width: number }) {
  return (
    <div
      style={{ width }}
      className={cn(
        "h-5 px-2 text-[11px] truncate leading-5 flex items-center font-medium rounded shadow-2xl",
        "bg-accent/30 text-accent-fg ring-2 ring-accent",
        task.is_completed && "line-through opacity-60"
      )}
    >
      {task.title}
    </div>
  );
}

function priorityBg(priority: number) {
  if (priority >= 5) return "bg-p-high/15 text-p-high";
  if (priority >= 3) return "bg-p-med/15 text-p-med";
  if (priority >= 1) return "bg-p-low/15 text-p-low";
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
  // Pull all tasks; client-filter to this day. Cheap because day pages
  // are bounded; avoids needing a date-range Tasks filter on the API.
  const { data: tasks = [] } = useTasks({ view: "all", includeCompleted: true });

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const dayTasks = tasks
    .filter((t) => {
      if (!t.due_at) return false;
      const due = new Date(t.due_at);
      if (due >= dayStart && due <= dayEnd) return true;
      if (t.start_at) {
        const s = new Date(t.start_at);
        if (s <= dayEnd && due >= dayStart) return true;
      }
      return false;
    })
    .sort((a, b) => {
      // All-day first, then by time ascending. Completed bubble down.
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
        {/* Inline add ÃÂ¢ÃÂÃÂ pre-fills due_at to this date so anything typed
            here lands on the visible day, even if the AI parser doesn't
            see an explicit date in the user's text. */}
        <InlineTaskInput
          defaultProjectId={null}
          defaultDueAt={dayStart.toISOString()}
        />

        {dayTasks.length === 0 ? (
          <div className="px-3 py-12 text-center text-muted-fg">
            <div className="text-3xl mb-2 font-display"><em>ÃÂ¢ÃÂÃÂ</em></div>
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
              Completed ÃÂÃÂ· {completed.length}
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
