"use client";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { TaskListView } from "@/components/app/task-list-view";
import { DayTimeline, DayViewToggle, useDayViewMode } from "@/components/app/day-timeline";
import { useUIStore } from "@/store/ui";

/**
 * Today — toggleable between the editorial list (default) and the new
 * vertical timeline that shows time-blocked tasks against an hour rail.
 * Choice persists per-device via localStorage (see useDayViewMode).
 */
export default function TodayPage() {
  const [mode, setMode] = useDayViewMode();
  const setQuickAdd = useUIStore((s) => s.setQuickAddOpen);

  if (mode === "list") {
    return (
      <TaskListView
        title="Today"
        subtitle={format(new Date(), "EEEE, MMMM d")}
        filter={{ view: "today" }}
        showDailyEdition
        headerExtra={<DayViewToggle mode={mode} setMode={setMode} />}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight truncate">
              Today
            </h1>
            <p className="text-sm text-muted-fg mt-1">
              {format(new Date(), "EEEE, MMMM d")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DayViewToggle mode={mode} setMode={setMode} />
            <button className="btn-ghost gap-2" onClick={() => setQuickAdd(true)}>
              <Plus className="size-4" />
              Quick add
            </button>
          </div>
        </div>
      </div>
      <DayTimeline date={new Date()} />
    </div>
  );
}
