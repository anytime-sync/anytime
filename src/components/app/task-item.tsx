"use client";

import { Calendar, Clock, Flag, Hash, ListTree, Repeat } from "lucide-react";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { useToggleTask, useSubtaskCounts } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
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
  // Resolve the task's project so we can render a "~ListName" pill on the
  // row. Smart views (Today / Tomorrow / Next 7 / Next 90) pull tasks
  // from every list, so without this you can't tell at a glance which
  // list a task belongs to.
  const { data: projects = [] } = useProjects();
  const project = task.project_id
    ? projects.find((p: any) => p.id === task.project_id)
    : null;

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
        {/* Inline notes preview — first line, muted, truncated. */}
        {task.notes && !task.is_completed && (
          <p className="text-xs text-muted-fg mt-0.5 line-clamp-1 leading-snug">
            {task.notes}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-fg">
          {task.due_at && <DueChip due_at={task.due_at} all_day={task.is_all_day} />}
          {/* Duration: explicit start->end range wins; otherwise estimated. */}
          {(task.start_at && task.due_at && !task.is_all_day) ||
          task.estimated_pomodoros > 0 ? (
            <DurationChip task={task} />
          ) : null}
          {task.priority > 0 && (
            <span className="inline-flex items-center gap-1">
              <Flag className={cn("size-3", priorityColorClass(task.priority))} />
            </span>
          )}
          {/* Project pill — shows the list a task lives in. Hidden when
              there's no project (Inbox tasks). Same coloring scheme as
              the sidebar list dot. */}
          {project && (
            <span
              className="inline-flex items-center h-5 rounded px-1.5 text-[11px] font-medium leading-none"
              style={{
                backgroundColor: (project as any).color
                  ? `${(project as any).color}22`
                  : "var(--muted)",
                color: (project as any).color || "var(--muted-fg)",
                border: `1px solid ${(project as any).color || "var(--border)"}`,
              }}
              title={`In list: ${(project as any).name}`}
            >
              ~{(project as any).name}
            </span>
          )}
          {/* Tags render as color-block pills — same visual language as
              the sidebar tag list, the inline preview, and the task-detail
              tag editor, so a tag looks identical anywhere it appears. */}
          {task.tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center h-5 rounded px-1.5 text-[11px] font-medium leading-none"
              style={{ backgroundColor: t.color || "var(--accent)", color: "#fff" }}
            >
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

/**
 * Duration chip — shows either an explicit time range ("10:00-11:00") when
 * the task has both start_at + due_at, or a duration ("30m" / "1h 30m")
 * derived from estimated pomodoros (each = 25 min).
 */
function DurationChip({ task }: { task: TaskWithTags }) {
  if (task.start_at && task.due_at && !task.is_all_day) {
    const s = new Date(task.start_at);
    const e = new Date(task.due_at);
    const min = Math.max(0, Math.round((+e - +s) / 60_000));
    const fmt = (d: Date) =>
      d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return (
      <span className="inline-flex items-center gap-1" title={`${min} min`}>
        <Clock className="size-3" />
        {fmt(s)}–{fmt(e)}
      </span>
    );
  }
  const est = task.estimated_pomodoros * 25;
  if (est > 0) {
    const label = est >= 60 ? `${Math.round(est / 60)}h ${est % 60 || ""}m`.trim() : `${est}m`;
    return (
      <span className="inline-flex items-center gap-1" title="Estimated">
        <Clock className="size-3" />
        {label}
      </span>
    );
  }
  return null;
}

function DueChip({ due_at, all_day }: { due_at: string; all_day: boolean }) {
  const d = new Date(due_at);
  const overdue = !isToday(d) && isPast(d);
  const label = isToday(d)
    ? all_day
      ? "Today"
      : `Today ${format(d, "h:mm a")}`
    : isTomorrow(d)
    ? all_day
      ? "Tomorrow"
      : `Tomorrow ${format(d, "h:mm a")}`
    : all_day
    ? format(d, "MMM d")
    : format(d, "MMM d, h:mm a");
  return (
    <span className={cn("inline-flex items-center gap-1", overdue && "text-danger")}>
      <Calendar className="size-3" /> {label}
    </span>
  );
}
