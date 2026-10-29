import { describe, expect, it } from "vitest";
import { enUS } from "date-fns/locale";
import { renderDigestHtml, renderDigestText, type DigestPayload, type DigestTask } from "./daily-digest-template";
import { buildDigestAgenda, type DigestCalendarEvent } from "./digest-agenda";

const payload: DigestPayload = {
  recipientName: "Aaron", language: "en", locale: enUS,
  date: new Date("2026-10-03T23:00:20Z"), timezone: "Asia/Taipei",
  topToday: [], q1Today: [], overdue: [], agenda: [], habitsToday: 0, streakDays: 0,
  appUrl: "https://firstlight.to", unsubUrl: "https://firstlight.to/unsubscribe",
  chrome: {
    kicker: "Daily edition", headline: "Today", intro: "Your day",
    sectionTopToday: "Top", sectionQ1: "Priority", sectionOverdue: "Overdue",
    sectionCalendar: "Today's calendar", allDay: "All day", untitledEvent: "Untitled event",
    cta: "Open", footer: "Footer", unsubLabel: "Unsubscribe", noTasks: "None",
    streakSuffix: n => `${n} days`, habitsSummary: n => `${n} habits`,
  },
};

describe.each([renderDigestHtml, renderDigestText])("recipient-local digest", render => {
  it("shows Sunday October 4 for Taipei even while UTC is Saturday", () => {
    const result = render(payload);
    expect(result).toContain("Sunday, October 4");
    expect(result).not.toContain("Saturday, October 3");
  });
  it("shows previous local date for a recipient west of UTC", () => {
    expect(render({ ...payload, timezone: "America/Los_Angeles", date: new Date("2026-10-04T01:00:00Z") })).toContain("Saturday, October 3");
  });
  it("does not invent clock times for all-day tasks; overdue has its date", () => {
    const result = render({ ...payload,
      topToday: [{ id: "1", title: "All day", due_at: "2026-10-04T09:00:00Z", priority: 1, is_all_day: true }],
      overdue: [{ id: "2", title: "Old deadline", due_at: "2026-10-01T04:00:00Z", priority: 1, is_all_day: false }],
    });
    expect(result).not.toContain("5:00 PM");
    expect(result).toContain("Oct 1, 2026");
    expect(result).toContain("12:00 PM");
  });
});

const meeting: DigestTask = {
  id: "meeting", title: "Meeting", priority: 4, is_all_day: false, time_kind: null,
  start_at: "2026-10-30T02:30:00Z", due_at: "2026-10-30T08:00:00Z",
};
const meetingDay = { ...payload, date: new Date("2026-10-29T23:00:00Z") };

describe.each([renderDigestHtml, renderDigestText])("task time rendering", render => {
  it.each([null, undefined, "work"] as const)("shows the actual 5.5-hour interval for intent %s without changing the task", time_kind => {
    const task = Object.freeze({ ...meeting, time_kind });
    expect(render({ ...meetingDay, q1Today: [task] })).toContain("10:30 AM – 4:00 PM");
    expect(task).toEqual({ ...meeting, time_kind });
  });

  it.each([
    ["Asia/Taipei", "10:30 AM – 4:00 PM"],
    ["UTC", "Oct 30, 2026, 2:30 AM – Oct 30, 2026, 8:00 AM"],
    ["America/Los_Angeles", "7:30 PM – Oct 30, 2026, 1:00 AM"],
  ])("uses the recipient's dates and timezone: %s", (timezone, expected) => {
    expect(render({ ...meetingDay, timezone, topToday: [meeting] })).toContain(expected);
  });

  it.each([
    ["overnight", "2026-10-29T15:00:00Z", "2026-10-29T17:00:00Z", "Oct 29, 2026, 11:00 PM – 1:00 AM"],
    ["multiday", "2026-10-28T02:30:00Z", "2026-10-30T08:00:00Z", "Oct 28, 2026, 10:30 AM – 4:00 PM"],
    ["ending tomorrow", "2026-10-30T02:30:00Z", "2026-10-31T08:00:00Z", "10:30 AM – Oct 31, 2026, 4:00 PM"],
  ])("preserves explicit work %s", (_, start_at, due_at, expected) => {
    expect(render({ ...meetingDay, topToday: [{ ...meeting, time_kind: "work", start_at, due_at }] })).toContain(expected);
  });

  it.each(["+08:00", "+0800"])("accepts explicit timezone offsets: %s", offset => {
    expect(render({ ...meetingDay, topToday: [{ ...meeting,
      start_at: `2026-10-30T10:30:00${offset}`, due_at: `2026-10-30T16:00:00${offset}` }] })).toContain("10:30 AM – 4:00 PM");
  });

  it("shows only the due time for a deadline with an availability start", () => {
    const result = render({ ...meetingDay, topToday: [{ ...meeting, time_kind: "deadline" }] });
    expect(result).toContain("4:00 PM");
    expect(result).not.toContain("10:30 AM");
    expect(result).not.toContain(" – ");
  });

  it("keeps unknown long windows on the existing legacy display path", () => {
    const result = render({ ...meetingDay, topToday: [{ ...meeting, start_at: "2026-10-28T02:30:00Z" }] });
    expect(result).toContain("4:00 PM");
    expect(result).not.toContain("Oct 28");
    expect(result).not.toContain(" – ");
  });

  it("uses inclusive local dates for spans even without an all-day flag", () => {
    const result = render({ ...meetingDay, topToday: [{ ...meeting, time_kind: "span",
      start_at: "2026-10-28T16:00:00Z", due_at: "2026-10-30T16:00:00Z" }] });
    expect(result).toContain("Oct 29, 2026 – Oct 31, 2026");
    expect(result).not.toContain("12:00 AM");
  });

  it.each(["Asia/Taipei", "America/Los_Angeles"])("keeps date-only endpoints civil in %s", timezone => {
    const result = render({ ...meetingDay, timezone,
      topToday: [{ ...meeting, time_kind: "span", start_at: "2026-10-29", due_at: "2026-10-31" }],
      overdue: [{ ...meeting, id: "date-only", time_kind: "deadline", due_at: "2026-10-27" }],
    });
    expect(result).toContain("Oct 29, 2026 – Oct 31, 2026");
    expect(result).toContain("Oct 27, 2026");
    expect(result).not.toMatch(/\d:\d{2}/);
  });

  it("does not invent clock times for all-day tasks or date-only work endpoints", () => {
    const result = render({ ...meetingDay, topToday: [
      { ...meeting, is_all_day: true },
      { ...meeting, id: "date-range", time_kind: "work", start_at: "2026-10-29", due_at: "2026-10-31" },
    ] });
    expect(result).toContain("Oct 29, 2026 – Oct 31, 2026");
    expect(result).not.toMatch(/\d:\d{2}/);
  });

  it.each([null, "work", "span", "deadline"] as const)("falls back to a valid due label for malformed/reversed %s endpoints", time_kind => {
    for (const start_at of [null, "not-a-date", "2026-02-30T02:30:00Z", "2026-10-30T02:30:00", "2026-10-31T02:30:00Z", meeting.due_at]) {
      const result = render({ ...meetingDay, topToday: [{ ...meeting, time_kind, start_at }] });
      if (time_kind !== "span") expect(result).toContain("4:00 PM");
      else expect(result).not.toMatch(/\d:\d{2}/);
      expect(result).not.toContain(" – ");
      expect(result).not.toContain("Invalid Date");
    }
  });

  it("omits invalid/missing due labels instead of fabricating an interval", () => {
    for (const due_at of [null, "not-a-date", "2026-02-30", "2026-02-30T08:00:00Z", "2026-10-30T08:00:00"]) {
      const result = render({ ...meetingDay, topToday: [{ ...meeting, time_kind: "work", due_at }] });
      expect(result).toContain("Meeting");
      expect(result).not.toMatch(/\d:\d{2}/);
      expect(result).not.toContain(" – ");
      expect(result).not.toContain("Invalid Date");
    }
  });

  it("falls back to the due time when a civil start date follows the local due date", () => {
    const result = render({ ...meetingDay, timezone: "America/Los_Angeles", topToday: [{ ...meeting,
      time_kind: "work", start_at: "2026-10-30", due_at: "2026-10-30T02:30:00Z" }] });
    expect(result).toContain("7:30 PM");
    expect(result).not.toContain(" – ");
  });

  it("renders overdue ranges with both recipient-local dates", () => {
    expect(render({ ...meetingDay, date: new Date("2026-10-31T23:00:00Z"), overdue: [meeting] }))
      .toContain("Oct 30, 2026, 10:30 AM – Oct 30, 2026, 4:00 PM");
  });
});

const event = (id: string, overrides: Partial<DigestCalendarEvent> = {}): DigestCalendarEvent => ({
  id, title: id, start_at: "2026-10-17T01:30:00Z", end_at: "2026-10-17T04:30:00Z",
  is_all_day: false, cancelled: false, status: "confirmed", task_id: null, ...overrides,
});

describe.each([renderDigestHtml, renderDigestText])("calendar agenda rendering", render => {
  it("shows the same local times, cross-midnight dates and inclusive all-day spans", () => {
    const result = render({ ...payload, date: new Date("2026-10-16T23:00:00Z"),
      agenda: buildDigestAgenda([
        event("Lesson"),
        event("Overnight", { start_at: "2026-10-16T15:00:00Z", end_at: "2026-10-16T17:00:00Z" }),
        event("Trip", { start_at: "2026-10-16", end_at: "2026-10-19", is_all_day: true }),
      ], "2026-10-17", "Asia/Taipei", new Set()),
    });
    expect(result).toContain("9:30 AM – 12:30 PM");
    expect(result).toContain("Oct 16, 2026, 11:00 PM – 1:00 AM");
    expect(result).toContain("All day · Oct 16, 2026 – Oct 18, 2026");
    expect(result).not.toContain("Oct 19");
    expect(result.indexOf("Trip")).toBeLessThan(result.indexOf("Overnight"));
    expect(result.indexOf("Overnight")).toBeLessThan(result.indexOf("Lesson"));
  });

  it("labels an untitled event and omits an empty agenda section", () => {
    const withEvent = render({ ...payload, agenda: [{ id: "1", title: "  ", start: "2026-10-04T01:30:00Z", end: null, isAllDay: false }] });
    expect(withEvent).toContain("Untitled event");
    expect(withEvent).toContain("9:30 AM");
    expect(render(payload).toLowerCase()).not.toContain("today&#39;s calendar");
    expect(render(payload).toLowerCase()).not.toContain("today's calendar");
  });
});

it("escapes calendar titles in HTML while preserving their text alternative", () => {
  const p = { ...payload, agenda: [{ id: "1", title: '<img src=x onerror="alert(1)"> & \'lesson\'', start: "2026-10-04", end: "2026-10-05", isAllDay: true }] };
  const html = renderDigestHtml(p);
  expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;lesson&#39;");
  expect(html).not.toContain("<img src=x");
  expect(renderDigestText(p)).toContain(p.agenda[0].title);
});
