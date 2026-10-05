import { projectTaskCalendar, validTimezone, taskCalendarDescription } from "./task-calendar";
import type { TaskTimeKind } from "./task-schedule";

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
  // Bump old events once so subscribers replace cached pre-fix date ranges.
  const feedRevision = Date.UTC(2026, 9, 5);

  for (const source of tasks) {
    const task = source;
    const projection = projectTaskCalendar(task, zone);
    if (!projection) continue;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${task.id}@firstlight.to`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`CREATED:${formatUtc(new Date(task.created_at))}`);
    lines.push(`LAST-MODIFIED:${formatUtc(new Date(Math.max(Date.parse(task.updated_at) || 0, feedRevision)))}`);

    if ('date' in projection.start && 'date' in projection.end) {
      lines.push(`DTSTART;VALUE=DATE:${projection.start.date.replace(/-/g, '')}`);
      lines.push(`DTEND;VALUE=DATE:${projection.end.date.replace(/-/g, '')}`);
    } else if ('dateTime' in projection.start && 'dateTime' in projection.end) {
      lines.push(`DTSTART:${formatUtc(new Date(projection.start.dateTime))}`);
      lines.push(`DTEND:${formatUtc(new Date(projection.end.dateTime))}`);
    }
    lines.push(`SUMMARY:${escapeText(task.title || "(untitled)")}`);
    const description = taskCalendarDescription(task.notes, projection, zone);
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
