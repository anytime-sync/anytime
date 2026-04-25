"use client";

import { Calendar, Flag, Hash, ListTree, Repeat } from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { useToggleTask, useSubtaskCounts } from "@/hooks/use-tasks";
import { useUIStore } from "@/store/ui";
import type { TaskWithTags } from "@/hooks/use-tasks";
import { cn, priorityColorClass } from "@/lib/utils";

export function TaskItem({ task }: { task: TaskWithTags }) {
  const toggle = useToggleTask();
  const selectedId = useUIStore((s) => s.selectedTaskId);
  const setSelected = useUIStore((s) => s.setSelectedTaskId);
  const isSelected = selectedId === task.id;
  const { data: counts = {} } = useSubtaskCounts([task.id]);
  const subCount = counts[task.id];

  return (
    <div
      onClick={() => setSelected(task.id)}
      className={cn(
        "group flex items-start gap-3 px-3 py-2 rounded-md cursor-pointer border border-transparent",
        isSelected ? "bg-muted border-border" : "hover:bg-muted/60"
      )}
    >
      <button
        aria-label={task.is_completed ? "Mark incomplete" : "Mark complete"}
        onClick={(e) => {
          e.stopPropagation();
          toggle(task);
        }}
        className={cn(
          "mt-0.5 size-5 rounded-full border-2 grid place-items-center transition-colors shrink-0",
          task.is_completed
            ? "bg-success border-success text-white"
            : task.priority >= 5
            ? "border-p-high"
            : task.priority >= 3
            ? "border-p-med"
            : task.priority >= 1
            ? "border-p-low"
            : "border-muted-fg"
        )}
      >
        {task.is_completed && (
          <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-6" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-sm truncate",
            task.is_completed && "line-through text-muted-fg"
          )}
        >
          {task.title}
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-fg">
          {task.due_at && <DueChip due_at={task.due_at} all_day={task.is_all_day} />}
          {task.priority > 0 && (
            <span className="inline-flex items-center gap-1">
              <Flag className={cn("size-3", priorityColorClass(task.priority))} />
            </span>
          )}
          {task.tags.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1">
              <Hash className="size-3" style={{ color: t.color }} />
              {t.name}
            </span>
          ))}
          {task.rrule && (
            <span className="inline-flex items-center gap-1" title="Repeats">
              <Repeat className="size-3" />
            </span>
          )}
          {subCount && subCount.total > 0 && (
            <span className="inline-flex items-center gap-1" title="Subtasks">
              <ListTree className="size-3" /> {subCount.done}/{subCount.total}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DueChip({ due_at