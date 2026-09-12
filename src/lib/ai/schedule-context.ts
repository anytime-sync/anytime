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

import { calendarDate, dayWindow } from "@/lib/day-window";
import { calendarTask } from "@/lib/task-schedule";
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

export function scheduleDates(now: Date, tz: string, count: number): string[] {
  const first = Date.parse(calendarDate(now, tz));
  return Array.from({ length: count }, (_, i) => new Date(first + i * 86400000).toISOString().slice(0, 10));
}

type ScheduledItem = { title?: string | null; start_at: string | null; end_at?: string | null; due_at?: string | null; is_all_day?: boolean };

export function buildScheduleDays(dates: string[], tz: string, events: ScheduledItem[], tasks: ScheduledItem[], prefs: UserWorkPrefs, now: Date): DaySchedule[] {
  return dates.map(date => {
    const { start, nextStart } = dayWindow(date, tz);
    const busyBlocks: BusyBlock[] = [];
    const add = (item: ScheduledItem, end: string | null | undefined) => {
      if (item.is_all_day || !item.start_at || !end) return;
      const s = Date.parse(item.start_at), e = Date.parse(end);
      if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s || s >= +nextStart || e <= +start) return;
      busyBlocks.push({
        start: s <= +start ? '00:00' : toLocalTime(item.start_at, tz),
        end: e >= +nextStart ? '24:00' : toLocalTime(end, tz),
        label: item.title ?? 'Busy',
      });
    };
    for (const event of events) add(event, event.end_at);
    for (const source of tasks) {
      const task = calendarTask(source);
      add(task, task.due_at);
    }
    busyBlocks.sort((a,b) => toMinutes(a.start) - toMinutes(b.start));
    const elapsed: BusyBlock[] = +now >= +nextStart ? [{ start: '00:00', end: '24:00', label: 'Past' }]
      : +now > +start ? [{ start: '00:00', end: toLocalTime(now.toISOString(), tz), label: 'Past' }] : [];
    const freeMinutes = Math.min(prefs.dailyCapacityMinutes, computeFreeMinutes([...busyBlocks, ...elapsed], prefs.workStart, prefs.workEnd));
    return { date, dayOfWeek: DOW[new Date(date).getUTCDay()], busyBlocks, freeMinutes };
  });
}

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
 * Uses 3 parallel Supabase queries (prefs + bulk events + bulk tasks)
 * instead of 2 queries per day — avoids 14+ sequential round trips.
 */
export async function fetchScheduleContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  tz: string,
  horizonDays = 7
): Promise<ScheduleContext> {
  const now = new Date();

  // Compute the full window once
  const dates = scheduleDates(now, tz, Math.max(1, Math.min(31, Math.floor(horizonDays))));
  const windowStart = dayWindow(dates[0], tz).start;
  const windowEnd = dayWindow(dates[dates.length - 1], tz).nextStart;

  // 3 parallel fetches: prefs + all events in window + all blocked tasks in window
  const [prefsRes, eventsRes, tasksRes] = await Promise.all([
    supabase
      .from("user_preferences")
      .select("energy_peak_start,energy_peak_end,default_task_minutes,daily_capacity_minutes")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("calendar_events")
      .select("title,start_at,end_at,is_all_day")
      .eq("user_id", userId)
      .eq("cancelled", false)
      .gt("end_at", windowStart.toISOString())
      .lt("start_at",  windowEnd.toISOString())
      .order("start_at", { ascending: true })
      .limit(201),
    supabase
      .from("tasks")
      .select("title,start_at,due_at,is_all_day")
      .eq("user_id", userId)
      .eq("is_completed", false)
      .neq("status", "archived")
      .not("start_at", "is", null)
      .not("due_at",   "is", null)
      .gt("due_at", windowStart.toISOString())
      .lt("start_at",  windowEnd.toISOString())
      .limit(201),
  ]);

  const prefs = prefsRes.data;
  const allEvents = eventsRes.data ?? [];
  const allTasks  = tasksRes.data  ?? [];
  if (eventsRes.error || tasksRes.error) throw new Error('Calendar availability could not be loaded. Try again before planning.');
  if (allEvents.length > 200 || allTasks.length > 200) throw new Error('Too many schedule items to calculate availability safely. Use a shorter planning horizon.');

  const workPrefs: UserWorkPrefs = {
    workStart: "09:00",
    workEnd: "18:00",
    energyPeakStart: prefs?.energy_peak_start ?? "09:00",
    energyPeakEnd:   prefs?.energy_peak_end   ?? "12:00",
    defaultTaskMinutes:   prefs?.default_task_minutes   ?? 30,
    dailyCapacityMinutes: prefs?.daily_capacity_minutes ?? 480,
  };

  const days = buildScheduleDays(dates, tz, allEvents, allTasks, workPrefs, now);

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
  lines.push(`SCHEDULE (next ${ctx.days.length} days):`);
  for (const day of ctx.days) {
    const busyStr = day.busyBlocks.length === 0
      ? "OPEN"
      : "busy: " + day.busyBlocks.map((b) => `${b.start}-${b.end} ${b.label}`).join(" · ");
    lines.push(`${day.date} ${day.dayOfWeek} | free: ${day.freeMinutes}min | ${busyStr}`);
  }
  return lines.join("\n");
}
