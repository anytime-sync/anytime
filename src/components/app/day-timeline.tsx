"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format, isSameDay, startOfDay, endOfDay } from "date-fns";
import { Clock } from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { useUserPrefs } from "@/hooks/use-ai";
import { useUIStore } from "@/store/ui";
import { cn, priorityColorClass } from "@/lib/utils";

/**
 * DayTimeline — vertical hour-rail view of a single day.
 *
 * Layout:
 *   - Left rail: hour markers from 6 AM to 11 PM, 56px per hour.
 *   - Each task with a time renders as an absolutely positioned block.
 *   - All-day / undated tasks stack at the top.
 *   - A red current-time line; the page auto-scrolls so it lands ~1/3
 *     down on first paint.
 *   - Energy-peak window (from user_preferences) gets a faint warm tint
 *     across the rail to advertise deep-work hours.
 *   - Buffer labels ("15 min buffer") render in gaps between consecutive
 *     scheduled blocks so the day reads as a plan, not a list.
 */

const RAIL_START_HOUR = 6;
const RAIL_END_HOUR = 23;
const PX_PER_HOUR = 56;
const PX_PER_MIN = PX_PER_HOUR / 60;
const RAIL_HEIGHT = (RAIL_END_HOUR - RAIL_START_HOUR) * PX_PER_HOUR;

function minutesFromRailStart(d: Date): number {
  return (d.getHours() - RAIL_START_HOUR) * 60 + d.getMinutes();
}

function parseHHMM(s?: string | null): { h: number; m: number } | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return null;
  return { h: +m[1]!, m: +m[2]! };
}

export function DayTimeline({ date }: { date: Date }) {
  const { data: tasks = [] } = useTasks({ view: "all", includeCompleted: true });
  const { data: prefs } = useUserPrefs();
  const setSelected = useUIStore((s) => s.setSelectedTaskId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const isToday = isSameDay(date, now);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isToday || !containerRef.current) return;
    const m = minutesFromRailStart(now);
    const target = Math.max(0, m * PX_PER_MIN - 200);
    containerRef.current.scrollTo({ top: target });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const dayTasks = useMemo(
    () =>
      tasks.filter((t) => {
        const anchor = t.start_at ?? t.due_at;
        if (!anchor) return false;
        const a = new Date(anchor);
        return a >= dayStart && a <= dayEnd;
      }),
    [tasks, dayStart.getTime(), dayEnd.getTime()]
  );

  const allDayTasks = dayTasks.filter((t) => t.is_all_day || (!t.start_at && !t.due_at));
  const timed = dayTasks
    .filter((t) => !t.is_all_day && t.due_at)
    .map((t) => {
      const due = new Date(t.due_at!);
      const start = t.start_at ? new Date(t.start_at) : new Date(due.getTime() - 30 * 60_000);
      const startMin = minutesFromRailStart(start);
      const endMin = minutesFromRailStart(due);
      const visStart = Math.max(0, startMin);
      const visEnd = Math.min((RAIL_END_HOUR - RAIL_START_HOUR) * 60, endMin);
      return { task: t, start, due, startMin, endMin, visStart, visEnd };
    })
    .filter((t) => t.visEnd > t.visStart)
    .sort((a, b) => a.startMin - b.startMin);

  const buffers: Array<{ key: string; top: number; minutes: number }> = [];
  for (let i = 0; i < timed.length - 1; i++) {
    const a = timed[i]!;
    const b = timed[i + 1]!;
    const gap = b.startMin - a.endMin;
    if (gap >= 10) {
      const top = (a.endMin + gap / 2) * PX_PER_MIN;
      buffers.push({ key: `${a.task.id}-${b.task.id}`, top, minutes: gap });
    }
  }

  const peak = (() => {
    const a = parseHHMM(prefs?.energy_peak_start);
    const b = parseHHMM(prefs?.energy_peak_end);
    if (!a || !b) return null;
    const startMin = (a.h - RAIL_START_HOUR) * 60 + a.m;
    const endMin = (b.h - RAIL_START_HOUR) * 60 + b.m;
    if (endMin <= startMin) return null;
    return { top: startMin * PX_PER_MIN, height: (endMin - startMin) * PX_PER_MIN };
  })();

  const nowTop = isToday ? minutesFromRailStart(now) * PX_PER_MIN : null;

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      {allDayTasks.length > 0 && (
        <div className="border-b border-border px-4 md:px-6 py-2 space-y-1">
          <p className="editorial-number text-[10px]">All day</p>
          <div className="flex flex-wrap gap-1.5">
            {allDayTasks.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 h-6 rounded text-xs",
                  "bg-muted hover:bg-muted/80",
                  t.is_completed && "line-through opacity-60"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    priorityColorClass(t.priority).replace("text-", "bg-")
                  )}
                />
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative" style={{ height: RAIL_HEIGHT }}>
        {peak && (
          <div
            aria-hidden
            className="absolute left-14 right-4 bg-accent/[0.06] border-l-2 border-accent/30"
            style={{ top: peak.top, height: peak.height }}
          />
        )}

        {Array.from({ length: RAIL_END_HOUR - RAIL_START_HOUR + 1 }, (_, i) => {
          const h = RAIL_START_HOUR + i;
          const top = i * PX_PER_HOUR;
          return (
            <div
              key={h}
              className="absolute left-0 right-0 flex items-start"
              style={{ top }}
            >
              <span className="w-14 pl-3 pr-2 text-[10px] text-muted-fg uppercase tracking-wider tabular-nums">
                {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
              </span>
              <div className="flex-1 border-t border-border/60" />
            </div>
          );
        })}

        {buffers.map((b) => (
          <div
            key={b.key}
            aria-hidden
            className="absolute left-14 right-4 text-center text-[10px] text-muted-fg/70"
            style={{ top: b.top - 6 }}
          >
            {b.minutes < 60 ? `${b.minutes} min` : `${Math.round((b.minutes / 60) * 10) / 10}h`} buffer
          </div>
        ))}

        {timed.map((t) => {
          const top = t.visStart * PX_PER_MIN;
          const height = Math.max(24, (t.visEnd - t.visStart) * PX_PER_MIN - 2);
          const tone = priorityColorClass(t.task.priority);
          return (
            <button
              key={t.task.id}
              onClick={() => setSelected(t.task.id)}
              className={cn(
                "absolute left-14 right-4 rounded-md text-left px-3 py-2",
                "border surface hover:shadow-sm transition-shadow",
                "flex flex-col gap-0.5 overflow-hidden",
                t.task.is_completed && "opacity-60"
              )}
              style={{
                top,
                height,
                borderColor: "hsl(var(--border))",
                borderLeftWidth: 3,
                borderLeftColor: "currentColor",
              }}
            >
              <span className={cn("inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider tabular-nums", tone)}>
                <Clock className="size-3" />
                {format(t.start, "h:mm a")} – {format(t.due, "h:mm a")}
              </span>
              <span className={cn("text-sm font-medium leading-snug truncate", t.task.is_completed && "line-through")}>
                {t.task.title}
              </span>
              {t.task.notes && height > 56 && (
                <span className="text-[11px] text-muted-fg leading-snug line-clamp-2">
                  {t.task.notes}
                </span>
              )}
            </button>
          );
        })}

        {nowTop != null && nowTop >= 0 && nowTop <= RAIL_HEIGHT && (
          <div
            aria-hidden
            className="absolute left-0 right-0 z-10 pointer-events-none"
            style={{ top: nowTop }}
          >
            <div className="flex items-center">
              <span className="w-14 pl-3 pr-2 text-[10px] font-medium text-danger tabular-nums">
                {format(now, "h:mm")}
              </span>
              <div className="flex-1 h-px bg-danger" />
              <span className="size-2 -mr-1 rounded-full bg-danger" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function useDayViewMode() {
  const [mode, setMode] = useState<"list" | "timeline">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem("fl.dayMode") as any) ?? "list";
  });
  function setAndPersist(m: "list" | "timeline") {
    setMode(m);
    try { localStorage.setItem("fl.dayMode", m); } catch {}
  }
  return [mode, setAndPersist] as const;
}

export function DayViewToggle({
  mode,
  setMode,
}: {
  mode: "list" | "timeline";
  setMode: (m: "list" | "timeline") => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden text-xs shrink-0">
      {(["list", "timeline"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={cn(
            "px-3 h-7 capitalize",
            mode === m ? "bg-fg text-bg" : "btn-ghost rounded-none"
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
