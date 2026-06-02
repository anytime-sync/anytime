"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  format,
  isSameDay,
  startOfWeek,
  eachDayOfInterval,
  isAfter,
  startOfDay,
  differenceInCalendarDays,
} from "date-fns";
import {
  useHabits,
  useHabitLogs,
  useToggleHabitLog,
  useCreateHabit,
  useDeleteHabit,
} from "@/hooks/use-habits";
import { Plus, Check, ChevronLeft, ChevronRight, Flame, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { t as tr, getLanguage } from "@/lib/i18n";

/**
 * Habits â weekly grid where each row is a habit and each column is a
 * day. Click a cell to log/unlog a completion. Streak count is computed
 * from consecutive days back from today (or the latest day with a log)
 * so it's always meaningful even when reviewing past weeks.
 */
export default function HabitsPage() {
  const lang = useLanguage();
  const dfLocale = getLanguage(lang).dateFnsLocale;
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("\ud83c\udfaf");
  const create = useCreateHabit();
  const remove = useDeleteHabit();

  // Week offset: 0 = this week, -1 = last week, +1 = next week, etc.
  const [weekOffset, setWeekOffset] = useState(0);

  const today = useMemo(() => startOfDay(new Date()), []);
  const baseStart = useMemo(
    () => startOfWeek(today, { weekStartsOn: 1 }),
    [today]
  );
  const weekStart = useMemo(
    () => addDays(baseStart, weekOffset * 7),
    [baseStart, weekOffset]
  );
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const days = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd]
  );

  const rangeStart = format(weekStart, "yyyy-MM-dd");
  const rangeEnd = format(weekEnd, "yyyy-MM-dd");

  const { data: habits = [] } = useHabits();
  // Pull a wider range so streak math has enough history. We grab the
  // last 60 days from the visible weekEnd — streaks > 60 days are
  // capped at "60+" which is fine for UI.
  const streakRangeStart = format(addDays(weekEnd, -60), "yyyy-MM-dd");
  const { data: logs = [] } = useHabitLogs(streakRangeStart, rangeEnd);
  const toggle = useToggleHabitLog();

  // Compute current streak per habit — number of consecutive days
  // ending at today (or the most recent logged day if today isn't logged
  // yet) where the habit was logged.
  const streakById = useMemo(() => {
    const out: Record<string, number> = {};
    for (const h of habits) {
      const logged = new Set(
        logs
          .filter((l) => l.habit_id === h.id)
          .filter((l) => (l.count ?? 0) > 0 || l.status != null)
          .map((l) => l.log_date)
      );
      let n = 0;
      // Allow today's empty cell to not break a streak: start from today
      // and walk back skipping today only if not logged.
      let cursor = today;
      if (!logged.has(format(cursor, "yyyy-MM-dd"))) {
        cursor = addDays(cursor, -1);
      }
      while (logged.has(format(cursor, "yyyy-MM-dd")) && n < 365) {
        n++;
        cursor = addDays(cursor, -1);
      }
      out[h.id] = n;
    }
    return out;
  }, [habits, logs, today]);

  const subtitle =
    (() => {
      const range = `${format(weekStart, "MMM d", { locale: dfLocale })} \u2013 ${format(weekEnd, "MMM d", { locale: dfLocale })}`;
      const key =
        weekOffset === 0
          ? "view.habits.thisWeek"
          : weekOffset === -1
          ? "view.habits.lastWeek"
          : weekOffset === 1
          ? "view.habits.nextWeekRange"
          : "view.habits.weekRange";
      return tr(lang, key as any).replace("{range}", range);
    })();

  const colTemplate = "minmax(160px,1fr) repeat(7, 48px) 56px 28px";

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-3 border-b border-border flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight">
            {tr(lang, "sidebar.habits")}
          </h1>
          <p className="text-xs text-muted-fg mt-1 truncate">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            className="btn-ghost size-7 p-0 grid place-items-center"
            onClick={() => setWeekOffset((o) => o - 1)}
            aria-label={tr(lang, "view.habits.aria.prevWeek")}
            title={tr(lang, "view.habits.aria.prevWeek")}
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
            aria-label={tr(lang, "view.habits.aria.thisWeek")}
            title={tr(lang, "view.habits.aria.thisWeek")}
          >
            |
          </button>
          <button
            className="btn-ghost size-7 p-0 grid place-items-center"
            onClick={() => setWeekOffset((o) => o + 1)}
            aria-label={tr(lang, "view.habits.aria.nextWeek")}
            title={tr(lang, "view.habits.aria.nextWeek")}
          >
            <ChevronRight className="size-4" />
          </button>
          <button className="btn-primary gap-2" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> {tr(lang, "view.habits.newHabit")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        <div className="card p-3">
          <div
            className="grid"
            style={{ gridTemplateColumns: colTemplate }}
          >
            <div />
            {days.map((d: Date) => {
              const isToday = isSameDay(d, today);
              return (
                <div
                  key={d.toISOString()}
                  className={cn(
                    "text-center text-xs",
                    isToday ? "text-accent" : "text-muted-fg"
                  )}
                >
                  <div>{format(d, "EEE", { locale: dfLocale })}</div>
                  <div
                    className={cn(
                      "font-medium",
                      isToday
                        ? "text-accent font-display text-base leading-tight"
                        : "text-fg"
                    )}
                  >
                    {format(d, "d")}
                  </div>
                </div>
              );
            })}
            <div className="text-center text-xs text-muted-fg uppercase tracking-wider">
              {tr(lang, "view.habits.streakHeader")}
            </div>
            <div />
          </div>

          <div className="mt-3 space-y-1">
            {habits.length === 0 && (
              <div className="text-sm text-muted-fg space-y-1 px-2 py-3">
                <p>{tr(lang, "view.habits.emptyText")}</p>
                <p className="text-xs">{tr(lang, "view.habits.emptyHint")}</p>
              </div>
            )}
            {habits.map((h) => {
              const streak = streakById[h.id] ?? 0;
              return (
                <div
                  key={h.id}
                  className="grid items-center"
                  style={{ gridTemplateColumns: colTemplate }}
                >
                  <div className="flex items-center gap-2 px-2">
                    <span className="text-lg">{h.icon}</span>
                    <span className="text-sm">{h.name}</span>
                  </div>
                  {days.map((d: Date) => {
                    const iso = format(d, "yyyy-MM-dd");
                    const log = logs.find(
                      (l) => l.habit_id === h.id && l.log_date === iso
                    );
                    const isFuture = isAfter(startOfDay(d), today);
                    const isToday = isSameDay(d, today);
                    return (
                      <button
                        key={iso}
                        disabled={isFuture}
                        onClick={() =>
                          toggle.mutate({
                            habitId: h.id,
                            dateIso: iso,
                            current: log,
                          })
                        }
                        className={cn(
                          "mx-auto size-8 rounded-md grid place-items-center border transition-colors",
                          log
                            ? "border-success bg-success/15 text-success"
                            : "border-border hover:bg-muted",
                          isToday && !log && "ring-1 ring-accent/40",
                          isFuture && "opacity-30 cursor-not-allowed"
                        )}
                        style={
                          log
                            ? {
                                borderColor: h.color,
                                backgroundColor: `${h.color}22`,
                                color: h.color,
                              }
                            : {}
                        }
                        title={
                          isFuture
                            ? format(d, "MMM d", { locale: dfLocale })
                            : log
                            ? tr(lang, "view.habits.tooltipLogged").replace("{date}", format(d, "MMM d", { locale: dfLocale }))
                            : tr(lang, "view.habits.tooltipLog").replace("{date}", format(d, "MMM d", { locale: dfLocale }))
                        }
                      >
                        {log ? <Check className="size-4" /> : null}
                      </button>
                    );
                  })}
                  <div
                    className={cn(
                      "text-center text-sm tabular-nums inline-flex items-center justify-center gap-1",
                      streak > 0 ? "text-accent" : "text-muted-fg/60"
                    )}
                    title={
                      streak > 0
                        ? tr(lang, "view.habits.streakDays").replace("{n}", String(streak))
                        : tr(lang, "view.habits.noStreak")
                    }
                  >
                    {streak > 0 && <Flame className="size-3.5" />}
                    {streak}
                  </div>
                  <button
                    type="button"
                    aria-label={tr(lang, "view.habits.deleteAria").replace("{name}", h.name)}
                    title={tr(lang, "view.habits.deleteTitle").replace("{name}", h.name)}
                    onClick={() => {
                      if (
                        window.confirm(
                          tr(lang, "view.habits.deleteConfirm").replace("{name}", h.name)
                        )
                      ) {
                        remove.mutate(h.id);
                      }
                    }}
                    className="mx-auto size-7 grid place-items-center rounded-md text-muted-fg/50 hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tiny intro card explaining what "habits" means here */}
        <div className="text-xs text-muted-fg leading-relaxed px-2 py-1">
          {tr(lang, "view.habits.intro")}
        </div>
      </div>

      {creating && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 animate-fade-in"
          onClick={() => setCreating(false)}
        >
          <div
            className="card w-[90vw] max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold">{tr(lang, "view.habits.newHabit")}</h3>
            <div className="flex gap-2">
              <input
                className="input w-16 text-center"
                maxLength={2}
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
              />
              <input
                className="input flex-1"
                placeholder={tr(lang, "view.habits.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setCreating(false)}>
                {tr(lang, "common.cancel")}
              </button>
              <button
                className="btn-primary"
                disabled={!name.trim()}
                onClick={async () => {
                  await create.mutateAsync({ name: name.trim(), icon });
                  setName("");
                  setCreating(false);
                }}
              >
                {tr(lang, "view.habits.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
