"use client";

import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import { TaskListView } from "@/components/app/task-list-view";
import {
  WeekTimeline,
  WeekViewToggle,
  useWeekViewMode,
} from "@/components/app/week-timeline";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";

/**
 * Next 7 Days â toggleable between the editorial list (default) and the
 * Mon-Sun week timeline. List shows date-sorted tasks; timeline shows a
 * 7-column hour grid with drag-to-reschedule across days and times.
 */
export default function Next7Page() {
  const [mode, setMode] = useWeekViewMode();
  const setQuickAdd = useUIStore((s) => s.setQuickAddOpen);
  const [weekOffset, setWeekOffset] = useState(0);

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

  // Timeline mode â reflect the offset in the subtitle so the header
  // matches the underlying date range the timeline renders.
  const baseStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStart = addDays(baseStart, weekOffset * 7);
  const weekEnd = addDays(weekStart, 6);
  const subtitle = `${format(weekStart, "MMM d")} â ${format(weekEnd, "MMM d")}`;

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
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              className="btn-ghost size-7 p-0 grid place-items-center"
              onClick={() => setWeekOffset((o) => o - 1)}
              aria-label="Previous week"
              title="Previous week"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              className={cn(
                "h-7 w-3 grid place-items-center text-muted-fg/60 text-[14px] font-display leading-none select-none",
                weekOffset === 0
                  ? "cursor-default"
                  : "hover:text-fg cursor-pointer"
              )}
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
              aria-label="This week"
              title="This week"
            >
              |
            </button>
            <button
              className="btn-ghost size-7 p-0 grid place-items-center"
              onClick={() => setWeekOffset((o) => o + 1)}
              aria-label="Next week"
              title="Next week"
            >
              <ChevronRight className="size-4" />
            </button>
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
      <WeekTimeline weekOffset={weekOffset} />
    </div>
  );
}
