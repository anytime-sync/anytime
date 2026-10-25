import { calendarTask } from "./task-schedule";
import { RRule } from "rrule";

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
  const feedRevision = Date.UTC(2026, 9, 4, 6, 48);

  for (const source of tasks) {
    // Completed recurrence masters must not generate future appointments.
    // Keep completion history in FL, not in the active calendar subscription.
    if (source.is_completed || source.status === "done" || source.status === "archived") continue;
    const task = calendarTask(source);
    const anchor = task.start_at ?? task.due_at ?? source.start_at;
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
      // An effort estimate is not a multi-day reservation.
      const minutes = task.estimated_minutes && Number.isFinite(task.estimated_minutes) && task.estimated_minutes > 0
        ? Math.min(task.estimated_minutes, 23 * 60 + 59)
        : 30;
      end = new Date(start.getTime() + minutes * 60 * 1000);
    }

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${task.id}@firstlight.to`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`CREATED:${formatUtc(new Date(task.created_at))}`);
    lines.push(`LAST-MODIFIED:${formatUtc(new Date(Math.max(Date.parse(task.updated_at) || 0, feedRevision)))}`);

    if (task.is_all_day) {
      // RFC 5545 §3.6.1: VALUE=DATE for all-day, DTEND is exclusive
      // (next day).
      const startDate = formatDate(start, zone);
      // Add a calendar day to the local DATE, not 24 hours to its UTC instant.
      const date = new Date(`${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}T00:00:00Z`);
      const endDate = formatDate(addDays(date, 1), "UTC");
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
    if (task.rrule) {
      const rule = recurrenceRule(task.rrule, task.is_all_day, zone);
      if (rule) lines.push(`RRULE:${rule}`);
    }
    lines.push("STATUS:CONFIRMED");
    // Deadlines and all-day task markers do not reserve the user's time.
    lines.push(`TRANSP:${task.is_all_day || !task.start_at ? "TRANSPARENT" : "OPAQUE"}`);
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

function validTimezone(timezone: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return timezone;
  } catch {
    return "UTC";
  }
}

function formatDate(d: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  return ["year", "month", "day"].map(type => parts.find(p => p.type === type)!.value).join("");
}

function recurrenceRule(input: string, allDay: boolean, timezone: string): string | null {
  let rule = input.trim().replace(/^RRULE:/i, "");
  // Never allow a stored rule to inject extra components into the feed.
  if (!rule || /[\r\n]/.test(rule)) return null;
  try { RRule.fromString(rule); } catch { return null; }
  if (allDay) {
    // DATE DTSTART requires DATE UNTIL; time selectors do not apply to DATE.
    rule = rule.split(";").filter(part => !/^(BYHOUR|BYMINUTE|BYSECOND)=/i.test(part)).map(part => {
      const until = /^UNTIL=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/i.exec(part);
      if (!until) return part;
      const [, y, m, d, h, min, sec] = until;
      return `UNTIL=${formatDate(new Date(`${y}-${m}-${d}T${h}:${min}:${sec}Z`), timezone)}`;
    }).join(";");
  }
  return rule;
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
