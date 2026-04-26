"use client";

import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { useMemo, useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useTasks, useUpdateTask, type TaskWithTags } from "@/hooks/use-tasks";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
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
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    if (!e.over) return;
    const taskId = String(e.active.id);
    const date = String(e.over.id); // yyyy-mm-dd
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    const orig = t.due_at ? new Date(t.due_at) : new Date();
    const [y, m, d] = date.split("-").map(Number);
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
          <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-px bg-border overflow-auto">
            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const dayTasks = tasks.filter((t) => t.due_at && isSameDay(new Date(t.due_at), d));
              return (
                <DayCell
                  key={key}
                  dateKey={key}
                  date={d}
                  inMonth={isSameMonth(d, monthStart)}
                  tasks={dayTasks}
                  activeId={activeId}
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
  dateKey, date, inMonth, tasks, activeId,
}: {
  dateKey: string;
  date: Date;
  inMonth: boolean;
  tasks: TaskWithTags[];
  activeId: string | null;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dateKey });
  const today = isSameDay(date, new Date());
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-bg p-1.5 min-h-[112px] flex flex-col gap-1 transition-colors",
        !inMonth && "opacity-50",
        isOver && "bg-muted"
      )}
    >
      <div className="flex items-center justify-between text-xs">
        <span className={cn(
          "size-6 grid place-items-center rounded-full",
          today ? "bg-accent text-accent-fg font-semibold" : "text-muted-fg"
        )}>
          {format(date, "d")}
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-1 overflow-hidden">
        {tasks.slice(0, 4).map((t) => (
          <DraggableTask key={t.id} task={t} dimmed={activeId === t.id} />
        ))}
        {tasks.length > 4 && (
          <div className="text-[10px] text-muted-fg pl-1">+ {tasks.length - 4} more</div>
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
      onDoubleClick={() => setSelected(task.id)}
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
  if (priority >= 5) return "bg-p-high/15 text-p-high";
  if (priority >= 3) return "bg-p-med/15 text-p-med";
  if (priority >= 1) return "bg-p-low/15 text-p-low";
  return "bg-muted text-fg";
}
