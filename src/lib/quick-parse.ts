import * as chrono from "chrono-node";

export type ParsedQuickInput = {
  title: string;
  /** Start of a timed task. Set when the user typed a range like
   *  "10am-11am" or "from 9 to 10". Null for due-only tasks. */
  start_at: string | null;
  due_at: string | null;
  is_all_day: boolean;
  priority: 0 | 1 | 3 | 5;
  tagNames: string[];
  projectName?: string;
  rrule: string | null;
  reminder_at: string | null;
  /**
   * Parsed minutes-before-due offset when the user typed
   * "remind me 30m before" without (yet) typing a date. We can't
   * compute reminder_at without due_at, but we surface the offset so
   * the live preview chip can still say "30m before" while the user
   * keeps typing.
   */
  reminder_offset_min?: number | null;
};

/**
 * Optional context passed in by callers that have access to the user's
 * existing tags + projects. When provided, the parser scans the
 * leftover title for any tag or project NAME mentioned in plain text
 * (no leading # or ~) and auto-attaches them. Lets a user type
 * "biz review meeting" and have the existing tags "biz review" and
 * "meeting" picked up automatically; "work" routes the task to the
 * existing "Work" list without typing ~Work.
 */
export type QuickParseContext = {
  existingTags?: string[];
  existingProjects?: string[];
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
export function parseQuickInput(raw: string, ctx?: QuickParseContext): ParsedQuickInput {
  // Normalize common typos / shorthands so the chrono fallback still gets
  // useful date phrases when the LLM parser is unavailable.
  let s = raw
    .trim()
    .replace(/\btmm?r\b/gi, "tomorrow")
    .replace(/\btmrw\b/gi, "tomorrow")
    .replace(/\btmrr?o(w)?\b/gi, "tomorrow")
    .replace(/\btnght\b/gi, "tonight")
    .replace(/\bmoring\b/gi, "morning");

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
      // "delegate" / "hand off" / "handoff" / "low priority" all map to
      // priority 1 so they classify into the Delegate quadrant in the
      // Eisenhower mini-matrix.
      [/\b(delegate|hand[\s-]?off|low\s*priority)\b/i, 1],
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

  // ---------- explicit cross-date range (M/D-M/D, M/D to M/D) ----------
  // Catches phrases chrono is unreliable on, like "5/5-5/8 biz trip" or
  // "May 5 to May 8". When matched, we set start_at / due_at directly
  // (all-day) and STRIP the phrase from `s` so the chrono pass below
  // doesn't double-parse it. The year defaults to the current year, but
  // if the range would fall more than 6 months in the past we bump it to
  // next year (so a January range parsed in November still lands forward).
  let rangeStartIso: string | null = null;
  let rangeEndIso: string | null = null;
  {
    const numericRangeRx = /\b(\d{1,2})\/(\d{1,2})\s*(?:[-\u2013\u2014]|to)\s*(\d{1,2})\/(\d{1,2})\b/i;
    const sameMonthRangeRx = /\b(\d{1,2})\/(\d{1,2})\s*[-\u2013\u2014]\s*(\d{1,2})\b(?!\/)/;
    const m = s.match(numericRangeRx);
    let m1: number | undefined, d1: number | undefined, m2: number | undefined, d2: number | undefined;
    let matchText: string | undefined;
    if (m) {
      m1 = parseInt(m[1]!, 10);
      d1 = parseInt(m[2]!, 10);
      m2 = parseInt(m[3]!, 10);
      d2 = parseInt(m[4]!, 10);
      matchText = m[0];
    } else {
      const m2nd = s.match(sameMonthRangeRx);
      if (m2nd) {
        m1 = parseInt(m2nd[1]!, 10);
        d1 = parseInt(m2nd[2]!, 10);
        m2 = m1;
        d2 = parseInt(m2nd[3]!, 10);
        matchText = m2nd[0];
      }
    }
    if (
      m1 !== undefined && d1 !== undefined && m2 !== undefined && d2 !== undefined &&
      m1 >= 1 && m1 <= 12 && d1 >= 1 && d1 <= 31 &&
      m2 >= 1 && m2 <= 12 && d2 >= 1 && d2 <= 31 &&
      matchText
    ) {
      const now = new Date();
      let year = now.getFullYear();
      let startDate = new Date(year, m1 - 1, d1);
      // If the parsed start is more than 6 months in the past, assume
      // the user meant next year.
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      if (startDate < sixMonthsAgo) {
        year += 1;
        startDate = new Date(year, m1 - 1, d1);
      }
      let endDate = new Date(year, m2 - 1, d2);
      // Range crosses a year boundary (e.g. 12/30-1/3). Bump the end.
      if (endDate < startDate) {
        endDate = new Date(year + 1, m2 - 1, d2);
      }
      rangeStartIso = startDate.toISOString();
      rangeEndIso = endDate.toISOString();
      s = s.replace(matchText, " ").replace(/\s+/g, " ").trim();
    }
  }

  // ---------- chrono date ----------
  // chrono returns BOTH start and end for range phrases like "10am-11am",
  // "from 9 to 10", "5-7pm tomorrow" — we use that to fill start_at + due_at.
  // Single anchors ("at 9am") set due_at only.
  //
  // When the user puts the time NOT adjacent to the date (e.g.
  // "5/6 meeting 14:00-17:00"), chrono returns TWO separate results —
  // one for the date, one for the time range. We merge them so the
  // order/separation in the input doesn't matter.
  let start_at: string | null = null;
  let due_at: string | null = null;
  let is_all_day = true;
  const results = chrono.parse(s, new Date(), { forwardDate: true });
  if (results.length) {
    const has = (r: any, k: string) => r?.start?.isCertain(k);
    const dateRes = results.find((r) => has(r, "day") || has(r, "weekday") || has(r, "month"));
    const timeRes = results.find((r) => has(r, "hour"));

    if (dateRes && timeRes && dateRes !== timeRes) {
      const baseDate = dateRes.start.date();
      const t1 = timeRes.start.date();
      const merged = new Date(baseDate);
      merged.setHours(t1.getHours(), t1.getMinutes(), 0, 0);
      if (timeRes.end) {
        const t2 = timeRes.end.date();
        const mergedEnd = new Date(baseDate);
        mergedEnd.setHours(t2.getHours(), t2.getMinutes(), 0, 0);
        start_at = merged.toISOString();
        due_at = mergedEnd.toISOString();
      } else {
        due_at = merged.toISOString();
      }
      is_all_day = false;
      const spans = [dateRes, timeRes].sort((a, b) => b.index - a.index);
      for (const sp of spans) {
        s = (s.slice(0, sp.index) + s.slice(sp.index + sp.text.length));
      }
      s = s.replace(/\s+/g, " ").trim();
    } else {
      const r = results[0]!;
      const startC = r.start;
      if (startC) {
        const known = (k: string) => startC.isCertain(k as any);
        is_all_day = !(known("hour") || known("minute"));
        if (r.end) {
          start_at = startC.date().toISOString();
          due_at = r.end.date().toISOString();
        } else {
          due_at = startC.date().toISOString();
        }
        s = (s.slice(0, r.index) + s.slice(r.index + r.text.length)).replace(/\s+/g, " ").trim();
      }
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

  // ---------- auto-detect existing tags / projects in the title ----------
  // The user may type a tag or list name in plain prose ("biz review
  // meeting" instead of "#biz-review #meeting"). When a context with
  // existing names is supplied, scan the title and auto-attach matches.
  // Longer names go first so "biz review" wins over a stray "biz" tag.
  if (ctx) {
    if (ctx.existingTags && ctx.existingTags.length > 0) {
      const sortedTags = [...ctx.existingTags].sort(
        (a, b) => b.length - a.length
      );
      for (const tagName of sortedTags) {
        if (!tagName) continue;
        // Case-insensitive whole-name match. We match on the title
        // (post-extraction) so a user can still type "#tag" explicitly
        // without it stacking with the auto-detected one.
        if (tagNames.some((t) => t.toLowerCase() === tagName.toLowerCase())) continue;
        const re = nameToWordRegex(tagName);
        if (re.test(title)) tagNames.push(tagName);
      }
    }
    if (
      !projectName &&
      ctx.existingProjects &&
      ctx.existingProjects.length > 0
    ) {
      const sortedProjects = [...ctx.existingProjects].sort(
        (a, b) => b.length - a.length
      );
      for (const projName of sortedProjects) {
        if (!projName) continue;
        const re = nameToWordRegex(projName);
        if (re.test(title)) {
          projectName = projName;
          break;
        }
      }
    }
  }

  return {
    title,
    start_at,
    due_at,
    is_all_day,
    priority: finalPriority,
    tagNames,
    projectName,
    rrule,
    reminder_at,
    reminder_offset_min: reminderOffsetMin,
  };
}

/**
 * Build a regex that matches the given tag/project name as a whole
 * "word" (or whole multi-word phrase) in free text. CJK names match
 * verbatim because there's no \b word boundary in those scripts.
 */
function nameToWordRegex(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Detect whether the name has any latin word chars; if not (CJK
  // names like "工作" / "회의"), skip word-boundary anchoring.
  const hasLatin = /[A-Za-z0-9_]/.test(name);
  return new RegExp(hasLatin ? `\\b${escaped}\\b` : escaped, "i");
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

  if (p.start_at && p.due_at && p.is_all_day) {
    // Multi-day all-day range — describe as "May 5 to May 8" rather than
    // pretending we have a time component.
    parts.push(`from ${formatDue(p.start_at, true, now)} to ${formatDue(p.due_at, true, now)}`);
  } else if (p.start_at && p.due_at) {
    parts.push(`from ${formatDue(p.start_at, false, now)} to ${formatTimeOnly(p.due_at)}`);
  } else if (p.due_at) {
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

/** Time-only format used in range descriptions ("from 10:00 AM to 11:00 AM"). */
function formatTimeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Friendly description of "now" for the preview header. */
export function describeNow(now: Date = new Date()): string {
  return `Right now: ${now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  })}, ${formatTime(now, now)}.`;
}
