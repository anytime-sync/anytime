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
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-px bg-border/15 overflow-auto relative">
            {days.map((d, i) => {
              const key = format(d, "yyyy-MM-dd");
              // Multi-day tasks now render as a chip on every covered
              // day (in addition to its own due day), so the same task
              // shows in each day's task list — no more separate bar
              // overlay with its own positioning math.
              const dayMs = startOfDay(d).getTime();
              const dayTasks = tasks.filter((t) => {
                if (!t.due_at) return false;
                const due = startOfDay(new Date(t.due_at)).getTime();
                if (t.start_at) {
                  const start = startOfDay(new Date(t.start_at)).getTime();
                  if (start !== due) {
                    return dayMs >= start && dayMs <= due;
                  }
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
                />
              );
            })}
          </div>
          <DragOverlay dropAnimation={{ duration: 150 }}>
            {activeTask ? <DragPreview task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function DayCell({
  dateKey, date, inMonth, tasks, activeId, onPickDay,
}: {
  dateKey: string;
  date: Date;
  inMonth: boolean;
  tasks: TaskWithTags[];
  activeId: string | null;
  onPickDay: (d: Date) => void;
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
      <div className="flex-1 flex flex-col gap-1 overflow-hidden" data-day-cell-hit="1">
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

function priorityBg(priority: number) {
  // Saturated chip backgrounds that read clearly on the translucent
  // calendar grid in both light and dark themes. Foreground stays
  // tied to text-fg so it inverts correctly per theme.
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
  // Pull all tasks; client-filter to this day. Cheap because day pages
  // are bounded; avoids needing a date-range Tasks filter on the API.
  const { data: tasks = [] } = useTasks({ view: "all", includeCompleted: true });

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const dayTasks = tasks
    .filter((t) => t.due_at && new Date(t.due_at) >= dayStart && new Date(t.due_at) <= dayEnd)
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
        {/* Inline add: pre-fills due_at to this date so anything typed
            here lands on the visible day, even if the AI parser doesn't
            see an explicit date in the user's text. */}
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
