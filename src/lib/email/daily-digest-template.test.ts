import { describe, expect, it } from "vitest";
import { enUS } from "date-fns/locale";
import { renderDigestHtml, renderDigestText, type DigestPayload } from "./daily-digest-template";

const payload: DigestPayload = {
  recipientName: "Aaron", language: "en", locale: enUS,
  date: new Date("2026-10-03T23:00:20Z"), timezone: "Asia/Taipei",
  topToday: [], q1Today: [], overdue: [], habitsToday: 0, streakDays: 0,
  appUrl: "https://firstlight.to", unsubUrl: "https://firstlight.to/unsubscribe",
  chrome: {
    kicker: "Daily edition", headline: "Today", intro: "Your day",
    sectionTopToday: "Top", sectionQ1: "Priority", sectionOverdue: "Overdue",
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
