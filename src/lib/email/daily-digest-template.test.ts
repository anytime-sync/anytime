import { describe, expect, it } from "vitest";
import { enUS } from "date-fns/locale";
import { renderDigestHtml, renderDigestText, type DigestPayload } from "./daily-digest-template";
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
