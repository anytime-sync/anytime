import { calendarTask } from "./task-schedule";

// ---------------------------------------------------------------------
// iCalendar serializer
//
// We deliberately keep this dependency-free — the format is small and
// well-specified, and pulling in `ical-generator` would add ~30KB to
// the lambda for no real win.
// ---------------------------------------------------------------------

export type TaskRow = {
  id: string;
  status?: string;
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
};

export function buildIcs(tasks: TaskRow[]): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//First Light//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push("X-WR-CALNAME:First Light");
  lines.push("X-WR-CALDESC:Tasks and meetings from First Light");
  // Pacific/Auckland is just a placeholder; events use UTC zulu times
  // so the calendar app translates to local time on display.
  lines.push("X-PUBLISHED-TTL:PT15M");

  const stamp = formatUtc(new Date());

  for (const stored of tasks) {
    if (stored.status === "archived") continue;
    const task = stored.is_all_day ? stored : calendarTask(stored);
    const anchor = task.start_at ?? task.due_at;
    if (!anchor) continue;
    const start = new Date(anchor);
    if (isNaN(start.getTime())) continue;

    // End time: prefer explicit due_at when it's after start_at; else
    // derive from estimated_minutes; else 30 min default. For all-day
    // events we use date-only DTSTART/DTEND with DTEND = next day.
    let end: Date;
    if (
      task.start_at &&
      task.due_at &&
      new Date(task.due_at) > new Date(task.start_at)
    ) {
      end = new Date(task.due_at);
    } else {
      const minutes = task.estimated_minutes && task.estimated_minutes > 0
        ? task.estimated_minutes
        : 30;
      end = new Date(start.getTime() + minutes * 60 * 1000);
    }

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${task.id}@firstlight.to`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`CREATED:${formatUtc(new Date(task.created_at))}`);
    lines.push(`LAST-MODIFIED:${formatUtc(new Date(task.updated_at))}`);

    if (task.is_all_day) {
      // RFC 5545 §3.6.1: VALUE=DATE for all-day, DTEND is exclusive
      // (next day).
      const startDate = formatDate(start);
      const endDate = formatDate(formatDate(end) > startDate ? end : addDays(start, 1));
      lines.push(`DTSTART;VALUE=DATE:${startDate}`);
      lines.push(`DTEND;VALUE=DATE:${endDate}`);
    } else {
      lines.push(`DTSTART:${formatUtc(start)}`);
      lines.push(`DTEND:${formatUtc(end)}`);
    }

    lines.push(`SUMMARY:${escapeText(task.title || "(untitled)")}`);
    if (task.notes && task.notes.trim()) {
      lines.push(`DESCRIPTION:${escapeText(task.notes)}`);
    }
    if (task.rrule && !task.is_completed) {
      // Pass the rrule through verbatim — date-fns / RRule library
      // already emits RFC-compliant strings.
      const trimmed = task.rrule.trim().replace(/^RRULE:/i, "");
      lines.push(`RRULE:${trimmed}`);
    }
    lines.push(`STATUS:${task.is_completed ? "CONFIRMED" : "CONFIRMED"}`);
    if (task.is_completed) {
      // Strikethrough hint for clients that respect it.
      lines.push("X-FL-COMPLETED:1");
    }
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

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

// RFC 5545 §3.1: lines longer than 75 octets must be folded with CRLF
// + space at column 76.
function foldLine(line: string): string {
  const parts: string[] = [];
  let chunk = "";
  let bytes = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    if (bytes + size > 75) {
      parts.push(chunk);
      chunk = " ";
      bytes = 1;
    }
    chunk += character;
    bytes += size;
  }
  parts.push(chunk);
  return parts.join("\r\n");
}
