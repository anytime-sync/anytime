import type { SupabaseClient } from "@supabase/supabase-js";
import { safeTimezone } from "./ai/tz";
import { addCalendarDays, dayWindow } from "./day-window";
import { parseQuickInput, type QuickParseContext } from "./quick-parse";
import { createTaskDates } from "./task-schedule";

/** Missing/invalid preferences use the same explicit UTC fallback as the app.
 * A failed preference read must not silently capture in a different zone. */
export async function accountTimezone(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from("user_preferences")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Account timezone unavailable. Try again.");
  return safeTimezone(data?.timezone);
}
export function parseChannelTask(
  text: string,
  timezone: string,
  context: QuickParseContext = {},
) {
  const parsed = parseQuickInput(text, {
    ...context,
    timezone: safeTimezone(timezone),
  });
  if (parsed.error) throw new Error(parsed.error);
  return { ...parsed, ...createTaskDates(parsed, safeTimezone(timezone)) };
}

export const notificationTaskColumns =
  "id,title,start_at,due_at,start_date,due_date,schedule_timezone,time_kind,priority,is_all_day";

/** Account-day agenda: deadlines are points; explicit work and civil spans
 * overlap the window. Unknown historical intent is never inferred here. */
export function channelTaskFilter(
  date: string,
  zone: string,
  days = 1,
  overdue = false,
) {
  const next = addCalendarDays(date, days);
  const from = dayWindow(date, zone).start.toISOString(),
    to = dayWindow(next, zone).start.toISOString();
  const civil = (key: string) =>
    overdue ? `${key}.lt.${date}` : `${key}.gte.${date},${key}.lt.${next}`;
  const instant = (key: string) =>
    overdue ? `${key}.lt.${from}` : `${key}.gte.${from},${key}.lt.${to}`;
  const points = `and(${civil("due_date")}),and(due_date.is.null,or(time_kind.is.null,time_kind.neq.work),${instant("due_at")}),and(due_date.is.null,due_at.is.null,${civil("start_date")}),and(due_date.is.null,due_at.is.null,start_date.is.null,${instant("start_at")})`;
  if (overdue)
    return `${points},and(time_kind.eq.work,due_date.is.null,due_at.lte.${from})`;
  return `${points},and(time_kind.eq.work,due_date.is.null,start_at.lt.${to},due_at.gt.${from}),and(time_kind.eq.span,start_date.lt.${next},due_date.gte.${date}),and(time_kind.eq.span,start_date.is.null,due_date.is.null,start_at.lt.${to},due_at.gte.${from})`;
}
