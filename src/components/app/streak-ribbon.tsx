"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTasks } from "@/hooks/use-tasks";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";
import { Flame, Target, CheckCircle2 } from "lucide-react";

/**
 * StreakRibbon — small rhythm summary on /app/today.
 *
 * Reads three at-a-glance signals already present in the database:
 *   - Current habit streak (consecutive days with at least one habit
 *     logged, walking back from today)
 *   - Habits logged today
 *   - Quadrant 1 tasks open today (priority >= 4 + due today)
 *
 * Pure-read, no AI calls, no cost. Cached locally to avoid layout
 * flicker when navigating back to Today.
 */
export function StreakRibbon() {
  const lang = useLanguage();
  const { data: tasks = [] } = useTasks({ view: "today" });
  const [streak, setStreak] = useState<number>(0);
  const [habitsToday, setHabitsToday] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const today = new Date().toISOString().slice(0, 10);

      // Habits logged today.
      const { count: doneToday } = await supabase
        .from("habit_logs")
        .select("habit_id", { count: "exact", head: true })
        .eq("logged_date", today);
      if (cancelled) return;
      setHabitsToday(doneToday ?? 0);

      // Streak: walk back from yesterday, count consecutive days with
      // any habit logged. Max look-back 90 days (anyone running longer
      // can refine later).
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 90);
      const { data: rows } = await supabase
        .from("habit_logs")
        .select("logged_date")
        .gte("logged_date", since.toISOString().slice(0, 10));
      if (cancelled) return;

      const days = new Set((rows ?? []).map((r) => r.logged_date as string));
      let s = 0;
      const cursor = new Date(today + "T00:00:00.000Z");
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      while (true) {
        const k = cursor.toISOString().slice(0, 10);
        if (days.has(k)) {
          s++;
          cursor.setUTCDate(cursor.getUTCDate() - 1);
        } else break;
      }
      setStreak(s);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const q1Count = useMemo(
    () => tasks.filter((task) => !task.is_completed && (task.priority ?? 0) >= 4).length,
    [tasks]
  );

  // Don't render if nothing to show — clean Today view stays clean.
  if (!loaded) return null;
  if (streak === 0 && habitsToday === 0 && q1Count === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 px-1 text-xs text-muted-fg">
      {streak > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <Flame className="size-3.5 text-warning" />
          <span>
            <span className="text-fg font-medium tabular-nums">{streak}</span>{" "}
            {t(lang, "ribbon.streak")}
          </span>
        </span>
      )}
      {habitsToday > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-success" />
          <span>
            <span className="text-fg font-medium tabular-nums">{habitsToday}</span>{" "}
            {t(lang, "ribbon.habits")}
          </span>
        </span>
      )}
      {q1Count > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <Target className="size-3.5 text-accent" />
          <span>
            <span className="text-fg font-medium tabular-nums">{q1Count}</span>{" "}
            {t(lang, "ribbon.q1")}
          </span>
        </span>
      )}
    </div>
  );
}
