/**
 * schedule-context.ts
 *
 * Builds a structured "schedule context" for AI routes that need to find
 * real available time slots — reschedule, plan-day, plan-week.
 *
 * Provides:
 * - busy blocks per day (calendar events + already time-blocked tasks)
 * - free windows per day (gaps between busy blocks, clipped to working hours)
 * - user working preferences (energy peak, capacity, default task duration)
 */

import { localDateStr, localDayBounds } from "./tz";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface BusyBlock {
  start: string;   // local HH:mm
  end: string;     // local HH:mm
  label: string;
}

export interface DaySchedule {
  date: string;          // YYYY-MM-DD in user tz
  dayOfWeek: string;     // "Mon", "Tue", etc.
  busyBlocks: BusyBlock[];
  freeMinutes: number;   // usable free minutes within working hours
}

export interface UserWorkPrefs {
  workStart: string;        // "09:00"
  workEnd: string;          // "18:00"
  energyPeakStart: string;  // from user_preferences
  energyPeakEnd: string;
  defaultTaskMinutes: number;
  dailyCapacityMinutes: number;
}

export interface ScheduleContext {
  prefs: UserWorkPrefs;
  days: DaySchedule[];     // next N days
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Format a UTC ISO string as local HH:mm in the given IANA tz. */
function toLocalTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).replace("24:", "00:");
}

/** Convert "HH:mm" to minutes since midnight. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Compute free minutes in [workStart, workEnd] minus busy blocks. */
function computeFreeMinutes(
  busyBlocks: BusyBlock[],
  workStart: string,
  workEnd: string
): number {
  const wsMin = toMinutes(workStart);
  const weMin = toMinutes(workEnd);
  const totalWork = weMin - wsMin;
  if (totalWork <= 0) return 0;

  // Merge overlapping busy intervals
  const intervals = busyBlocks
    .map((b) => ({ s: Math.max(toMinutes(b.start), wsMin), e: Math.min(toMinutes(b.end), weMin) }))
    .filter((i) => i.e > i.s)
    .sort((a, b) => a.s - b.s);

  let busyMinutes = 0;
  let cursor = wsMin;
  for (const iv of intervals) {
    if (iv.s > cursor) { /* gap */ }
    if (iv.e > cursor) {
      busyMinutes += iv.e - Math.max(iv.s, cursor);
      cursor = iv.e;
    }
  }
  return Math.max(0, totalWork - busyMinutes);
}

/**
 * Fetch schedule context for the next `horizonDays` days (default 7).
 * Pulls calendar events + time-blocked tasks from Supabase.
 */
export async function fetchScheduleContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  tz: string,
  horizonDays = 7
): Promise<ScheduleContext> {
  const now = new Date();

  // 1. User preferences
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("energy_peak_start,energy_peak_end,default_task_minutes,daily_capacity_minutes")
    .eq("user_id", userId)
    .maybeSingle();

  const workPrefs: UserWorkPrefs = {
    workStart: "09:00",
    workEnd: "18:00",
    energyPeakStart: prefs?.energy_peak_start ?? "09:00",
    energyPeakEnd:   prefs?.energy_peak_end   ?? "12:00",
    defaultTaskMinutes:   prefs?.default_task_minutes   ?? 30,
    dailyCapacityMinutes: prefs?.daily_capacity_minutes ?? 480,
  };

  // 2. Build day range
  const days: DaySchedule[] = [];
  for (let d = 0; d < horizonDays; d++) {
    const dayDate = new Date(now.getTime() + d * 86400_000);
    const { start: dayStart, end: dayEnd } = localDayBounds(dayDate, tz);
    const dateStr = localDateStr(dayDate, tz);
    const dowStr = DOW[dayDate.getUTCDay()];

    // 3. Calendar events for this day
    const { data: events } = await supabase
      .from("calendar_events")
      .select("title,start_at,end_at,is_all_day")
      .eq("user_id", userId)
      .eq("cancelled", false)
      .gte("start_at", dayStart.toISOString())
      .lt("start_at", dayEnd.toISOString())
      .order("start_at", { ascending: true })
      .limit(30);

    // 4. Time-blocked tasks for this day (have both start_at and due_at)
    const { data: blockedTasks } = await supabase
      .from("tasks")
      .select("title,start_at,due_at")
      .eq("user_id", userId)
      .eq("is_completed", false)
      .not("start_at", "is", null)
      .not("due_at", "is", null)
      .gte("start_at", dayStart.toISOString())
      .lt("start_at", dayEnd.toISOString())
      .limit(30);

    const busyBlocks: BusyBlock[] = [];

    for (const ev of events ?? []) {
      if (ev.is_all_day) continue; // all-day events don't block time
      if (!ev.start_at || !ev.end_at) continue;
      busyBlocks.push({
        start: toLocalTime(ev.start_at, tz),
        end:   toLocalTime(ev.end_at, tz),
        label: ev.title ?? "Event",
      });
    }

    for (const t of blockedTasks ?? []) {
      if (!t.start_at || !t.due_at) continue;
      busyBlocks.push({
        start: toLocalTime(t.start_at, tz),
        end:   toLocalTime(t.due_at, tz),
        label: t.title ?? "Task",
      });
    }

    // Sort by start time
    busyBlocks.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

    const freeMinutes = computeFreeMinutes(busyBlocks, workPrefs.workStart, workPrefs.workEnd);

    days.push({ date: dateStr, dayOfWeek: dowStr, busyBlocks, freeMinutes });
  }

  return { prefs: workPrefs, days };
}

/**
 * Render a ScheduleContext as a compact text block for AI prompts.
 * Example output:
 *
 * WORKING_HOURS: 09:00-18:00 | ENERGY_PEAK: 09:00-12:00 | DEFAULT_DURATION: 30min
 *
 * SCHEDULE (next 7 days):
 * 2026-06-21 Sun | free: 480min | OPEN
 * 2026-06-22 Mon | free: 330min | busy: 09:00-10:00 Standup · 14:00-15:30 QBR Review
 * 2026-06-23 Tue | free: 420min | busy: 11:00-12:00 Team Meeting
 */
export function renderScheduleContext(ctx: ScheduleContext): string {
  const lines: string[] = [];
  lines.push(
    `WORKING_HOURS: ${ctx.prefs.workStart}-${ctx.prefs.workEnd}` +
    ` | ENERGY_PEAK: ${ctx.prefs.energyPeakStart}-${ctx.prefs.energyPeakEnd}` +
    ` | DEFAULT_DURATION: ${ctx.prefs.defaultTaskMinutes}min` +
    ` | DAILY_CAPACITY: ${ctx.prefs.dailyCapacityMinutes}min`
  );
  lines.push("");
  lines.push("SCHEDULE (next 7 days):");
  for (const day of ctx.days) {
    const busyStr = day.busyBlocks.length === 0
      ? "OPEN"
      : "busy: " + day.busyBlocks.map((b) => `${b.start}-${b.end} ${b.label}`).join(" · ");
    lines.push(`${day.date} ${day.dayOfWeek} | free: ${day.freeMinutes}min | ${busyStr}`);
  }
  return lines.join("\n");
}
