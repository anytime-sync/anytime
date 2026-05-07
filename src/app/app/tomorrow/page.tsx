"use client";
import { addDays, format } from "date-fns";
import { Plus } from "lucide-react";
import { TaskListView } from "@/components/app/task-list-view";
import { DayTimeline, DayViewToggle, useDayViewMode } from "@/components/app/day-timeline";
import { useUIStore } from "@/store/ui";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";

/**
 * Tomorrow — same shape as Today: toggleable between the editorial list
 * (default) and the vertical timeline. The view-mode preference is
 * shared with Today via the `fl.dayMode` localStorage key, so flipping
 * one flips the other — a single mental setting for "how do I see a day".
 */
export default function TomorrowPage() {
  const lang = useLanguage();
  const [mode, setMode] = useDayViewMode();
  const setQuickAdd = useUIStore((s) => s.setQuickAddOpen);
  const tomorrow = addDays(new Date(), 1);

  if (mode === "list") {
    return (
      <TaskListView
        title={t(lang, "sidebar.tomorrow")}
        subtitle={format(tomorrow, "EEEE, MMMM d")}
        filter={{ view: "tomorrow" }}
        sortBy="due_at"
        sortKey="tomorrow"
        headerExtra={<DayViewToggle mode={mode} setMode={setMode} />}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight truncate">
              {t(lang, "sidebar.tomorrow")}
            </h1>
            <p className="text-sm text-muted-fg mt-1 truncate">
              {format(tomorrow, "EEEE, MMMM d")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DayViewToggle mode={mode} setMode={setMode} />
            <button
              className="btn-ghost gap-2 px-2 md:px-3"
              onClick={() => setQuickAdd(true)}
              aria-label={t(lang, "shared.quickAdd")}
              title={t(lang, "shared.quickAdd")}
            >
              <Plus className="size-4" />
              <span className="hidden md:inline">{t(lang, "shared.quickAdd")}</span>
            </button>
          </div>
        </div>
      </div>
      <DayTimeline date={tomorrow} />
    </div>
  );
}
