import * as chrono from "chrono-node";

export type ParsedQuickInput = {
  title: string;
  due_at: string | null;
  is_all_day: boolean;
  priority: 0 | 1 | 3 | 5;
  tagNames: string[];
  projectName?: string;
  rrule: string | null;
  reminder_at: string | null;
};

/**
 * Parse a free-form, conversational quick-add string:
 *
 *   "Email Sam tomorrow at 9am with a reminder 30 minutes before, urgent #work"
 *   "Pick up groceries every Friday at 6pm in Errands"
 *   "Stand-up meeting weekdays 10am, repeat weekly"
 *
 * Extracted:
 *   - dates via chrono-node (the first date phrase becomes due_at)
 *   - "remind me 30 mins before" / "with a reminder at 8am"  → reminder_at
 *   - "every day", "every Monday", "weekdays", "weekly", "monthly", "yearly" → rrule
 *   - "urgent" / "asap" / "high priority" → priority 5
 *     "important" / "medium priority"     → priority 3
 *     "low priority"                      → priority 1
 *     "no priority"                       → priority 0
 *     legacy "!1..!4"                     → priority 5/3/1/0
 *   - #tag → tags
 *   - ~ListName → project routing
 */
export function parseQuickInput(raw: string): ParsedQuickInput {
  let s = raw.trim();

  // ---------- priority ----------
  let priority: 0 | 1 | 3 | 5 | null = null;

  // !1..!4 (legacy)
  const pBang = s.match(/(^|\s)!([1-4])(\s|$)/);
  if (pBang) {
    const n = parseInt(pBang[2]!, 10);
    priority = (n === 1 ? 5 : n === 2 ? 3 : n === 3 ? 1 : 0) as 0 | 1 | 3 | 5;
    s = s.replace(pBang[0], " ").trim();
  }

  // natural-language priority phrases (don't override an explicit !N)
  if (priority === null) {
    const tests: Array<[RegExp, 0 | 1 | 3 | 5]> = [
      [/\b(urgent|asap|high\s*priority|top\s*priority)\b/i, 5],
      [/\b(important|medium\s*priority|med\s*priority)\b/i, 3],
      [/\blow\s*priority\b/i, 1],
      [/\bno\s*priority\b/i, 0],
    ];
    for (const [rx, p] of tests) {
      const m = s.match(rx);
      if (m) {
        priority = p;
        s = s.replace(m[0], " ").trim();
        break;
      }
    }
  }
  const finalPriority: 0 | 1 | 3 | 5 = priority ?? 0;

  // ---------- tags ----------
  const tagNames: string[] = [];
  s = s.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (_, lead, name) => {
    tagNames.push(name);
    return lead;
  }).trim();

  // ---------- project (~ListName) ----------
  let projectName: string | undefined;
  const lMatch = s.match(/(^|\s)~([\p{L}\p{N}_-]+)/u);
  if (lMatch) {
    projectName = lMatch[2];
    s = s.replace(lMatch[0], " ").trim();
  }

  // ---------- recurrence ----------
  // Pull recurrence first so the chrono parser doesn't gobble "every Monday".
  let rrule: string | null = null;
  type Rec = { rx: RegExp; rule: string };
  const recs: Rec[] = [
    { rx: /\bevery\s+weekday(s)?\b/i,            rule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
    { rx: /\bweekdays?\b/i,                      rule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
    { rx: /\bevery\s+(mon|monday)s?\b/i,         rule: "FREQ=WEEKLY;BYDAY=MO" },
    { rx: /\bevery\s+(tue|tues|tuesday)s?\b/i,   rule: "FREQ=WEEKLY;BYDAY=TU" },
    { rx: /\bevery\s+(wed|wednesday)s?\b/i,      rule: "FREQ=WEEKLY;BYDAY=WE" },
    { rx: /\bevery\s+(thu|thurs|thursday)s?\b/i, rule: "FREQ=WEEKLY;BYDAY=TH" },
    { rx: /\bevery\s+(fri|friday)s?\b/i,         rule: "FREQ=WEEKLY;BYDAY=FR" },
    { rx: /\bevery\s+(sat|saturday)s?\b/i,       rule: "FREQ=WEEKLY;BYDAY=SA" },
    { rx: /\bevery\s+(sun|sunday)s?\b/i,         rule: "FREQ=WEEKLY;BYDAY=SU" },
    { rx: /\bevery\s+day\b|\bdaily\b/i,          rule: "FREQ=DAILY" },
    { rx: /\bevery\s+week\b|\bweekly\b/i,        rule: "FREQ=WEEKLY" },
    { rx: /\bevery\s+month\b|\bmonthly\b/i,      rule: "FREQ=MONTHLY" },
    { rx: /\bevery\s+year\b|\byearly\b|\bannually\b/i, rule: "FREQ=YEARLY" },
  ];
  for (const r of recs) {
    const m = s.match(r.rx);
    if (m) {
      rrule = r.rule;
      // For day-of-week recurrence, leave the day word so chrono can still anchor the next occurrence.
      if (r.rule.startsWith("FREQ=WEEKLY;BYDAY=")) {
        s = s.replace(/\bevery\s+/i, " ").trim();
      } else {
        s = s.replace(r.rx, " ").replace(/\s+/g, " ").trim();
      }
      break;
    }
  }

  // ---------- reminder ----------
  // "remind me 30 mins/minutes before" or "with reminder N min(s)/hour(s) before"
  // "remind me at 8am" or "reminder at 8am"
  let reminderOffsetMin: number | null = null; // minutes before due
  let reminderAbsolute: Date | null = null;

  const offsetRx = /\b(?:with\s+(?:a\s+)?reminder|remind(?:\s+me)?)\s+(\d+)\s*(min(?:ute)?s?|hours?|h|m)\s+(?:before|prior)\b/i;
  const offMatch = s.match(offsetRx);
  if (offMatch) {
    const n = parseInt(offMatch[1]!, 10);
    const unit = offMatch[2]!.toLowerCase();
    reminderOffsetMin = unit.startsWith("h") ? n * 60 : n;
    s = s.replace(offMatch[0], " ").replace(/\s+/g, " ").trim();
  } else {
    const atRx = /\b(?:reminder|remind(?:\s+me)?)\s+at\s+(.+?)(?:[,.]|$)/i;
    const atMatch = s.match(atRx);
    if (atMatch) {
      const phrase = atMatch[1]!.trim();
      const r = chrono.parseDate(phrase, new Date(), { forwardDate: true });
      if (r) {
        reminderAbsolute = r;
        s = s.replace(atMatch[0], " ").replace(/\s+/g, " ").trim();
      }
    }
  }

  // ---------- chrono date ----------
  let due_at: string | null = null;
  let is_all_day = true;
  const results = chrono.parse(s, new Date(), { forwardDate: true });
  if (results.length) {
    const r = results[0]!;
    const start = r.start;
    if (start) {
      const known = (k: string) => start.isCertain(k as any);
      is_all_day = !(known("hour") || known("minute"));
      due_at = start.date().toISOString();
      s = (s.slice(0, r.index) + s.slice(r.index + r.text.length)).replace(/\s+/g, " ").trim();
    }
  }

  // ---------- compute reminder_at ----------
  let reminder_at: string | null = null;
  if (reminderAbsolute) {
    reminder_at = reminderAbsolute.toISOString();
  } else if (reminderOffsetMin !== null && due_at) {
    reminder_at = new Date(new Date(due_at).getTime() - reminderOffsetMin * 60_000).toISOString();
  }

  // ---------- title cleanup ----------
  // Remove leftover commas / linking words at edges.
  let title = s
    .replace(/\s+/g, " ")
    .replace(/^[\s,;.\-—:]+/, "")
    .replace(/[\s,;.\-—:]+$/, "")
    .trim();

  return {
    title,
    due_at,
    is_all_day,
    priority: finalPriority,
    tagNames,
    projectName,
    rrule,
    reminder_at,
  };
}

/**
 * Build a human-readable sentence describing what we'll create.
 * Used as a live preview in QuickAdd so the user can see the parse confirm
 * that the right intent was extracted.
 */
export function describeParsed(p: ParsedQuickInput, now: Date = new Date()): string {
  const parts: string[] = [];

  if (!p.title) return "Type a task. I'll parse the time, list, tags, and reminders for you.";

  parts.push(`I'll add "${p.title}"`);

  if (p.due_at) {
    parts.push(`due ${formatDue(p.due_at, p.is_all_day, now)}`);
  }
  if (p.rrule) {
    parts.push(`repeating ${describeRrule(p.rrule)}`);
  }
  if (p.reminder_at) {
    parts.push(`with a reminder ${describeReminder(p.reminder_at, p.due_at, now)}`);
  }
  if (p.priority > 0) {
    parts.push(`${priorityWord(p.priority)} priority`);
  }
  if (p.projectName) {
    parts.push(`in "${p.projectName}"`);
  } else {
    parts.push(`in your Inbox`);
  }
  if (p.tagNames.length) {
    parts.push(`tagged ${p.tagNames.map((t) => `#${t}`).join(", ")}`);
  }

  return parts.join(", ") + ".";
}

function priorityWord(p: number): string {
  if (p >= 5) return "high";
  if (p >= 3) return "medium";
  if (p >= 1) return "low";
  return "no";
}

function describeRrule(rrule: string): string {
  const dayMap: Record<string, string> = {
    MO: "Monday", TU: "Tuesday", WE: "Wednesday", TH: "Thursday", FR: "Friday", SA: "Saturday", SU: "Sunday",
  };
  if (/FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR/i.test(rrule)) return "every weekday";
  const dayOnly = rrule.match(/FREQ=WEEKLY;BYDAY=([A-Z]{2})$/i);
  if (dayOnly) return `every ${dayMap[dayOnly[1]!.toUpperCase()] ?? dayOnly[1]}`;
  if (/FREQ=DAILY/i.test(rrule)) return "every day";
  if (/FREQ=WEEKLY/i.test(rrule)) return "every week";
  if (/FREQ=MONTHLY/i.test(rrule)) return "every month";
  if (/FREQ=YEARLY/i.test(rrule)) return "every year";
  return rrule;
}

function describeReminder(reminderIso: string, dueIso: string | null, now: Date): string {
  const r = new Date(reminderIso);
  if (dueIso) {
    const offsetMs = new Date(dueIso).getTime() - r.getTime();
    if (offsetMs > 0) {
      const min = Math.round(offsetMs / 60_000);
      if (min >= 60 && min % 60 === 0) {
        const hr = min / 60;
        return `${hr} ${hr === 1 ? "hour" : "hours"} before`;
      }
      return `${min} ${min === 1 ? "minute" : "minutes"} before`;
    }
  }
  return `at ${formatTime(r, now)}`;
}

function formatDue(iso: string, allDay: boolean, now: Date): string {
  const d = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfDayAfterTomorrow = new Date(startOfTomorrow);
  startOfDayAfterTomorrow.setDate(startOfDayAfterTomorrow.getDate() + 1);

  let dayPart: string;
  if (d >= startOfToday && d < startOfTomorrow) dayPart = "today";
  else if (d >= startOfTomorrow && d < startOfDayAfterTomorrow) dayPart = "tomorrow";
  else dayPart = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  if (allDay) return dayPart;
  return `${dayPart} at ${formatTime(d, now)}`;
}

function formatTime(d: Date, _now: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Friendly description of "now" for the preview header. */
export function describeNow(now: Date = new Date()): string {
  return `Right now: ${now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  })}, ${formatTime(now, now)}.`;
}
