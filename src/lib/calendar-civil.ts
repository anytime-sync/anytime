import {
  addCalendarDays,
  calendarDate,
  dayWindow,
  resolveLocalInput,
  validDate,
  wallClock,
} from './day-window';
import type { TaskDates } from './task-schedule';
import type { CalendarEvent } from './db.types';

/** A UTC-shaped civil value for date-fns grid arithmetic. Never persist this
 * Date as an instant. Local accessors deliberately mean civil components. */
export class CivilDate extends Date {
  getFullYear() {
    return this.getUTCFullYear();
  }
  getMonth() {
    return this.getUTCMonth();
  }
  getDate() {
    return this.getUTCDate();
  }
  getDay() {
    return this.getUTCDay();
  }
  getHours() {
    return this.getUTCHours();
  }
  getMinutes() {
    return this.getUTCMinutes();
  }
  getSeconds() {
    return this.getUTCSeconds();
  }
  getMilliseconds() {
    return this.getUTCMilliseconds();
  }
  getTimezoneOffset() {
    return 0;
  }
  setFullYear(y: number, m = this.getUTCMonth(), d = this.getUTCDate()) {
    return this.setUTCFullYear(y, m, d);
  }
  setMonth(m: number, d = this.getUTCDate()) {
    return this.setUTCMonth(m, d);
  }
  setDate(d: number) {
    return this.setUTCDate(d);
  }
  setHours(
    h: number,
    m = this.getUTCMinutes(),
    s = this.getUTCSeconds(),
    ms = this.getUTCMilliseconds(),
  ) {
    return this.setUTCHours(h, m, s, ms);
  }
  setMinutes(
    m: number,
    s = this.getUTCSeconds(),
    ms = this.getUTCMilliseconds(),
  ) {
    return this.setUTCMinutes(m, s, ms);
  }
  setSeconds(s: number, ms = this.getUTCMilliseconds()) {
    return this.setUTCSeconds(s, ms);
  }
  setMilliseconds(ms: number) {
    return this.setUTCMilliseconds(ms);
  }
}
export const civilTime = (instant: string | Date, zone: string) =>
  new CivilDate(+wallClock(new Date(instant), zone));
export const civilDay = (value: string | Date, zone: string) =>
  new CivilDate(
    typeof value === 'string' && validDate(value)
      ? value
      : calendarDate(new Date(value), zone),
  );
export const civilKey = (day: Date) => day.toISOString().slice(0, 10);
export const civilWindow = (day: Date, zone: string) =>
  dayWindow(civilKey(day), zone);

export function taskDays(task: TaskDates, zone: string) {
  const due = task.due_date ?? task.due_at ?? task.start_date ?? task.start_at;
  if (!due) return null;
  const end = task.due_date ?? calendarDate(new Date(due), zone);
  const start =
    task.time_kind === 'deadline'
      ? end
      : (task.start_date ??
        (task.start_at ? calendarDate(new Date(task.start_at), zone) : end));
  // Timed intervals are half-open. Timed deadlines remain point commitments.
  const last =
    task.time_kind === 'work' &&
    task.due_at &&
    Date.parse(task.due_at) > Date.parse(task.start_at ?? '')
      ? calendarDate(new Date(Date.parse(task.due_at) - 1), zone)
      : end;
  return { first: new CivilDate(start), last: new CivilDate(last) };
}
export function eventDays(
  event: Pick<CalendarEvent, 'start_at' | 'end_at' | 'is_all_day' | 'raw'>,
  zone: string,
) {
  if (!event.start_at) return null;
  const raw = event.raw as {
    start?: { date?: string };
    end?: { date?: string };
  } | null;
  const first =
    event.is_all_day && raw?.start?.date
      ? raw.start.date
      : calendarDate(new Date(event.start_at), zone);
  const last =
    event.is_all_day && raw?.end?.date
      ? addCalendarDays(raw.end.date, -1)
      : calendarDate(
          new Date(
            Date.parse(event.end_at ?? event.start_at) - (event.end_at ? 1 : 0),
          ),
          zone,
        );
  return { first: new CivilDate(first), last: new CivilDate(last) };
}
export function shiftInstantDays(iso: string, days: number, zone: string) {
  const civil = wallClock(new Date(iso), zone);
  civil.setUTCDate(civil.getUTCDate() + days);
  return resolveLocalInput(civil.toISOString().replace(/Z$/, ''), zone);
}
export function shiftTaskDays(
  task: TaskDates,
  days: number,
  zone: string,
): Pick<TaskDates, 'start_date' | 'due_date' | 'start_at' | 'due_at'> {
  if (task.due_date || task.start_date)
    return {
      ...(task.start_date
        ? { start_date: addCalendarDays(task.start_date, days) }
        : {}),
      ...(task.due_date
        ? { due_date: addCalendarDays(task.due_date, days) }
        : {}),
    };
  if (task.time_kind === 'work' && task.start_at && task.due_at) {
    const start = shiftInstantDays(task.start_at, days, zone);
    return {
      start_at: start,
      due_at: new Date(
        Date.parse(start) + Date.parse(task.due_at) - Date.parse(task.start_at),
      ).toISOString(),
    };
  }
  return {
    ...(task.start_at
      ? { start_at: shiftInstantDays(task.start_at, days, zone) }
      : {}),
    ...(task.due_at
      ? { due_at: shiftInstantDays(task.due_at, days, zone) }
      : {}),
  };
}
