import { projectTaskCalendar, validTimezone, taskCalendarDescription } from "./task-calendar";
import type { TaskTimeKind } from "./task-schedule";
import { getVtimezoneComponent } from '@touch4it/ical-timezones';
import { wallClock } from './day-window';

export type IcsTaskRow = {
  id: string;
  title: string;
  notes: string | null;
  start_at: string | null;
  due_at: string | null;
  is_all_day: boolean;
  is_completed: boolean;
  rrule: string | null;
  updated_at: string;
  created_at: string;
  estimated_minutes: number | null;
  status?: string | null;
  time_kind?: TaskTimeKind | null;
  start_date?: string | null;
  due_date?: string | null;
  schedule_timezone?: string | null;
};

export function buildIcs(tasks: IcsTaskRow[], timezone = "UTC", now = new Date()): string {
  const zone = validTimezone(timezone);
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//First Light//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push("X-WR-CALNAME:First Light");
  lines.push("X-WR-CALDESC:Tasks and meetings from First Light");
  lines.push(`X-WR-TIMEZONE:${zone}`);
  lines.push("X-PUBLISHED-TTL:PT15M");

  const stamp = formatUtc(now);
  const seriesZones = new Set(tasks.flatMap(task => {
    const p = projectTaskCalendar(task, zone);
    return p?.recurrence && !p.allDay && !p.legacy ? [validTimezone(task.schedule_timezone ?? zone)] : [];
  }));
  for (const seriesZone of seriesZones) {
    if (seriesZone === 'UTC') continue;
    const component = getVtimezoneComponent(seriesZone);
    if (!component) throw new Error(`ICS recurrence timezone is unsupported: ${seriesZone}`);
    // IANA aliases must use the same TZID as the event parameter.
    lines.push(...component.trim().split(/\r?\n/).map(line => line.startsWith('TZID:') ? `TZID:${seriesZone}` : line));
  }
  // Bump old events once so subscribers replace cached pre-fix date ranges.
  const feedRevision = Date.UTC(2026, 9, 25);

  for (const source of tasks) {
    const task = source;
    const projection = projectTaskCalendar(task, zone);
    if (!projection) continue;
    const seriesZone = validTimezone(task.schedule_timezone ?? zone);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${task.id}@firstlight.to`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`CREATED:${formatUtc(new Date(task.created_at))}`);
    const revision = projection.legacy ? Date.UTC(2026, 9, 4, 6, 48) : feedRevision;
    lines.push(`LAST-MODIFIED:${formatUtc(new Date(Math.max(Date.parse(task.updated_at) || 0, revision)))}`);

    if ('date' in projection.start && 'date' in projection.end) {
      lines.push(`DTSTART;VALUE=DATE:${projection.start.date.replace(/-/g, '')}`);
      lines.push(`DTEND;VALUE=DATE:${projection.end.date.replace(/-/g, '')}`);
    } else if ('dateTime' in projection.start && 'dateTime' in projection.end) {
      if (projection.recurrence && seriesZone !== 'UTC' && !projection.legacy) {
        lines.push(`DTSTART;TZID=${seriesZone}:${formatUtc(wallClock(new Date(projection.start.dateTime), seriesZone)).slice(0, -1)}`);
        // DURATION preserves elapsed work time even on an occurrence that
        // crosses a DST transition; a local DTEND would change its duration.
        const seconds = Math.floor(Date.parse(projection.end.dateTime) / 1000) - Math.floor(Date.parse(projection.start.dateTime) / 1000);
        lines.push(`DURATION:PT${seconds}S`);
      } else {
        lines.push(`DTSTART:${formatUtc(new Date(projection.start.dateTime))}`);
        lines.push(`DTEND:${formatUtc(new Date(projection.end.dateTime))}`);
      }
    }
    lines.push(`SUMMARY:${escapeText(task.title || "(untitled)")}`);
    const description = projection.legacy ? task.notes?.trim() ? task.notes : undefined
      : taskCalendarDescription(task.notes, projection, seriesZone);
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
    if (projection.recurrence) lines.push(`RRULE:${projection.recurrence}`);
    lines.push("STATUS:CONFIRMED");
    // Deadlines and all-day task markers do not reserve the user's time.
    lines.push(`TRANSP:${projection.transparency.toUpperCase()}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // RFC 5545 mandates CRLF line endings.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function escapeText(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

// RFC 5545 §3.1: lines longer than 75 octets must be folded with CRLF
// + space at column 76.
function foldLine(line: string): string {
  const parts: string[] = [];
  let chunk = "";
  let bytes = 0;
  // Iterate code points so Chinese and emoji never split mid-character.
  for (const char of line) {
    const length = Buffer.byteLength(char, "utf8");
    if (bytes + length > 75) {
      parts.push(chunk);
      chunk = " ";
      bytes = 1;
    }
    chunk += char;
    bytes += length;
  }
  parts.push(chunk);
  return parts.join("\r\n");
}
