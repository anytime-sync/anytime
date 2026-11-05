import { calendarDate, validDate } from "./day-window";
import { safeTimezone } from "./ai/tz";
import { legacyCalendarTask } from "./task-legacy-dates";
import type { TaskDates } from "./task-schedule";

export function notificationEndpoint(value?: string | null) {
  if (!value || !validDate(value.slice(0, 10))) return null;
  if (!validDate(value) && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const d = new Date(value);
  return Number.isFinite(+d) ? d : null;
}

/** Shared email/digest/Telegram renderer. Civil dates never pass through the
 * account zone; instants do. A pinned series/schedule zone is shown explicitly. */
export function taskNotificationDate(
  task: TaskDates,
  accountZone: string,
  language = "en",
  today?: Date,
) {
  const zone = safeTimezone(accountZone),
    locale = language === "en" ? "en-US" : language;
  const display = task.time_kind == null ? legacyCalendarTask(task) : task;
  const dueValue =
    task.due_date ??
    task.due_at ??
    (task.time_kind === "deadline" ? (task.start_date ?? task.start_at) : null);
  const due = notificationEndpoint(dueValue);
  if (!due || !dueValue) return "";
  const dateOf = (v: string, d: Date) =>
    validDate(v) ? v : calendarDate(d, zone);
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(`${date}T00:00:00Z`));
  const timed = (d: Date) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      ...(!today || calendarDate(d, zone) !== calendarDate(today, zone)
        ? ({ year: "numeric", month: "short", day: "numeric" } as const)
        : {}),
      hour: "numeric",
      minute: "2-digit",
      hour12: language === "en" || language === "ko",
    }).format(d);
  const civil =
    !!task.due_date ||
    !!task.start_date ||
    task.is_all_day ||
    task.time_kind === "span" ||
    validDate(dueValue);
  const dueDate = dateOf(dueValue, due),
    startValue = task.start_date ?? display.start_at,
    start = notificationEndpoint(startValue);
  let label = civil
    ? !today || dueDate !== calendarDate(today, zone)
      ? dateLabel(dueDate)
      : ""
    : timed(due);
  if (task.time_kind !== "deadline" && start && startValue && +due > +start) {
    if (civil || validDate(startValue)) {
      const startDate = dateOf(startValue, start);
      if (startDate < dueDate)
        label = `${dateLabel(startDate)} – ${dateLabel(dueDate)}`;
      else if (startDate === dueDate) label = dateLabel(dueDate);
    } else label = `${timed(start)} – ${timed(due)}`;
  }
  if (task.schedule_timezone && safeTimezone(task.schedule_timezone) !== zone) {
    label = `${label || dateLabel(dueDate)} (account: ${zone}; schedule: ${safeTimezone(task.schedule_timezone)})`;
  }
  return label;
}
