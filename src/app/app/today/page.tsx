"use client";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { TaskListView } from "@/components/app/task-list-view";
import { DayTimeline, DayViewToggle, useDayViewMode } from "@/components/app/day-timeline";
import { useUIStore } from "@/store/ui";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/lib/use-language";
import { PlanMyDayButton } from "@/components/app/plan-my-day-button";
import { TodayAiBar } from "@/components/app/today-ai-bar";
import { StreakRibbon } from "@/components/app/streak-ribbon";
import { MorningCopilotCard } from "@/components/app/morning-copilot-card";
import { Celebrations } from "@/components/app/celebrations";

/**
 * Today â toggleable between the editorial list (default) and the new
 * vertical timeline that shows time-blocked tasks against an hour rail.
 *
 * Choice persists per-device via localStorage (see useDayViewMode).
 */
export default function TodayPage() {
  const [mode, setMode] = useDayViewMode();
  const setQuickAdd = useUIStore((s) => s.setQuickAddOpen);
  const lang = useLanguage();

  if (mode === "list") {
    return (
      <>
        <Celebrations />
        <TaskListView
        title={t(lang, "sidebar.today")}
        subtitle={format(new Date(), "EEEE, MMMM d")}
        filter={{ view: "today" }}
        showDailyEdition
        sortBy="due_at"
        sortKey="today"
        prelude={<StreakRibbon />}
        headerExtra={
          <>
            <TodayAiBar />
            <PlanMyDayButton />
            <DayViewToggle mode={mode} setMode={setMode} />
          </>
        }
      />
      </>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight truncate">
              {t(lang, "sidebar.today")}
            </h1>
            <p className="text-sm text-muted-fg mt-1 truncate">
              {format(new Date(), "EEEE, MMMM d")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TodayAiBar />
            <PlanMyDayButton />
            <DayViewToggle mode={mode} setMode={setMode} />
            {/* Icon-only on mobile so the title isn't squeezed to "T..." */}
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
      <div className="px-4 md:px-6 pt-3">
        <MorningCopilotCard />
      </div>
      <DayTimeline date={new Date()} />
    </div>
  );
}
