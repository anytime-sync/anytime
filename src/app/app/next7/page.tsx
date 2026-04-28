"use client";

import { Plus } from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import { TaskListView } from "@/components/app/task-list-view";
import {
  WeekTimeline,
  WeekViewToggle,
  useWeekViewMode,
} from "@/components/app/week-timeline";
import { useUIStore } from "@/store/ui";

/**
 * Next 7 Days — toggleable between the editorial list (default) and the
 * Mon–Sun week timeline. List shows date-sorted tasks; timeline shows a
 * 7-column hour grid with drag-to-reschedule across days and times.
 */
export default function Next7Page() {
  const [mode, setMode] = useWeekViewMode();
  const setQuickAdd = useUIStore((s) => s.setQuickAddOpen);

  if (mode === "list") {
    return (
      <TaskListView
        title="Next 7 Days"
        subtitle="Tasks due within the next week."
        filter={{ view: "next7" }}
        sortBy="due_at"
        sortKey="next7"
        headerExtra={<WeekViewToggle mode={mode} setMode={setMode} />}
      />
    );
  }

  // Timeline mode — show the current ISO week (Mon–Sun) in the subtitle so
  // the header matches the underlying date range the timeline renders.
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const subtitle = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d")}`;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight truncate">
              Next 7 Days
            </h1>
            <p className="text-sm text-muted-fg mt-1 truncate">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <WeekViewToggle mode={mode} setMode={setMode} />
            <button
              className="btn-ghost gap-2 px-2 md:px-3"
              onClick={() => setQuickAdd(true)}
              aria-label="Quick add"
              title="Quick add"
            >
              <Plus className="size-4" />
              <span className="hidden md:inline">Quick add</span>
            </button>
          </div>
        </div>
      </div>
      <WeekTimeline />
    </div>
  );
}
