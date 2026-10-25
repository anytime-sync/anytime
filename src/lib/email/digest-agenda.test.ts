import { describe, expect, it } from "vitest";
import { buildDigestAgenda, type DigestCalendarEvent } from "./digest-agenda";

function event(id: string, overrides: Partial<DigestCalendarEvent> = {}): DigestCalendarEvent {
  return {
    id, title: id, start_at: "2026-10-17T01:30:00Z", end_at: "2026-10-17T04:30:00Z",
    is_all_day: false, cancelled: false, status: "confirmed", task_id: null, ...overrides,
  };
}

const agenda = (events: DigestCalendarEvent[], shown = new Set<string>()) =>
  buildDigestAgenda(events, "2026-10-17", "Asia/Taipei", shown);

describe("digest calendar selection", () => {
  it("includes the reported 09:30–12:30 Taipei occurrence and local midnight boundaries", () => {
    expect(agenda([
      event("lesson"),
      event("midnight", { start_at: "2026-10-16T16:00:00Z", end_at: "2026-10-16T17:00:00Z" }),
      event("tomorrow", { start_at: "2026-10-17T16:00:00Z", end_at: "2026-10-17T17:00:00Z" }),
      event("yesterday", { start_at: "2026-10-16T14:00:00Z", end_at: "2026-10-16T15:59:59Z" }),
    ]).map(e => e.id)).toEqual(["midnight", "lesson"]);
  });

  it("includes cross-midnight and spanning events but excludes an end exactly at day start", () => {
    expect(agenda([
      event("ended", { start_at: "2026-10-16T15:00:00Z", end_at: "2026-10-16T16:00:00Z" }),
      event("overnight", { start_at: "2026-10-16T15:00:00Z", end_at: "2026-10-16T17:00:00Z" }),
      event("spanning", { start_at: "2026-10-15T00:00:00Z", end_at: "2026-10-19T00:00:00Z" }),
      event("late", { start_at: "2026-10-17T15:30:00Z", end_at: "2026-10-17T17:00:00Z" }),
    ]).map(e => e.id)).toEqual(["spanning", "overnight", "late"]);
  });

  it.each([
    ["2026-03-08", "2026-03-08T05:00:00Z", "2026-03-09T03:59:00Z", "2026-03-09T04:00:00Z"],
    ["2026-11-01", "2026-11-01T04:00:00Z", "2026-11-02T04:59:00Z", "2026-11-02T05:00:00Z"],
  ])("uses the actual New York DST day on %s", (date, start, lastMinute, nextStart) => {
    const items = buildDigestAgenda([
      event("first", { start_at: start, end_at: start }),
      event("last", { start_at: lastMinute, end_at: nextStart }),
      event("next", { start_at: nextStart, end_at: null }),
      event("ended", { start_at: "2026-03-01T00:00:00Z", end_at: start }),
    ], date, "America/New_York", new Set());
    expect(items.map(e => e.id)).toEqual(["first", "last"]);
  });

  it.each(["Asia/Taipei", "America/Los_Angeles", "Pacific/Kiritimati"])("keeps all-day dates floating in %s with exclusive ends", timezone => {
    const items = buildDigestAgenda([
      event("today", { is_all_day: true, start_at: "2026-10-17T00:00:00+00:00", end_at: "2026-10-18T00:00:00+00:00" }),
      event("span", { is_all_day: true, start_at: "2026-10-16", end_at: "2026-10-19" }),
      event("yesterday", { is_all_day: true, start_at: "2026-10-16", end_at: "2026-10-17" }),
      event("tomorrow", { is_all_day: true, start_at: "2026-10-18", end_at: "2026-10-19" }),
      // Quick-create may mirror 23:59:59 on the exclusive end date before sync.
      event("mirror-ended", { is_all_day: true, start_at: "2026-10-16", end_at: "2026-10-17T23:59:59Z" }),
    ], "2026-10-17", timezone, new Set());
    expect(items.map(e => e.id)).toEqual(["span", "today"]);
    expect(items[1]).toMatchObject({ start: "2026-10-17", end: "2026-10-18", isAllDay: true });
  });

  it("excludes either cancellation flag but keeps tentative and null-status events", () => {
    expect(agenda([
      event("flag", { cancelled: true }), event("status", { status: "cancelled" }),
      event("tentative", { status: "tentative" }), event("unspecified", { status: null }),
    ]).map(e => e.id)).toEqual(["tentative", "unspecified"]);
  });

  it("excludes invitations declined by this calendar's attendee, including all-day invitations", () => {
    expect(agenda([
      event("declined", { attendees: [{ self: true, responseStatus: "declined" }] }),
      event("all-day-declined", { is_all_day: true, start_at: "2026-10-17", end_at: "2026-10-18", attendees: [{ self: true, responseStatus: "declined" }] }),
      event("accepted", { attendees: [{ self: true, responseStatus: "accepted" }, { self: false, responseStatus: "declined" }] }),
      event("pending", { attendees: [{ self: true, responseStatus: "needsAction" }] }),
      event("tentative", { attendees: [{ self: true, responseStatus: "tentative" }] }),
      event("no-self", { attendees: [{ responseStatus: "declined" }] }),
    ]).map(e => e.id)).toEqual(["accepted", "no-self", "pending", "tentative"]);
  });

  it.each([null, undefined, {}, "declined", [null, false, "declined", {}, { self: "true", responseStatus: "declined" }]])(
    "tolerates absent or malformed attendee JSON: %j", attendees => {
      expect(agenda([event("appointment", { attendees })]).map(e => e.id)).toEqual(["appointment"]);
    },
  );

  it("deduplicates only links to displayed tasks, preserving unselected and unrelated events", () => {
    expect(agenda([
      event("urgent-copy", { task_id: "urgent" }), event("top-copy", { task_id: "top" }),
      event("overdue-copy", { task_id: "overdue" }), event("truncated-copy", { task_id: "truncated" }),
      event("completed-copy", { task_id: "completed" }), event("archived-copy", { task_id: "archived" }),
      event("unscheduled-copy", { task_id: "unscheduled" }), event("independent", { title: "Same task title" }),
    ], new Set(["urgent", "top", "overdue"])).map(e => e.id)).toEqual([
      "archived-copy", "completed-copy", "independent", "truncated-copy", "unscheduled-copy",
    ]);
  });

  it("retains distinct stored recurrence instances and their moved occurrence times", () => {
    expect(agenda([
      event("series_20261017_b", { title: "Recurring lesson", start_at: "2026-10-17T06:00:00Z", end_at: "2026-10-17T07:00:00Z" }),
      event("series_20261017_a", { title: "Recurring lesson" }),
      event("series_20261018", { title: "Recurring lesson", start_at: "2026-10-18T01:30:00Z", end_at: "2026-10-18T04:30:00Z" }),
      event("series_cancelled", { title: "Recurring lesson", status: "cancelled" }),
    ]).map(e => e.id)).toEqual(["series_20261017_a", "series_20261017_b"]);
  });

  it("sorts all-day dates before timed events with a deterministic simultaneous-start order", () => {
    expect(agenda([
      event("b"), event("all-day", { is_all_day: true, start_at: "2026-10-17", end_at: null }), event("a"),
    ]).map(e => e.id)).toEqual(["all-day", "a", "b"]);
  });

  it("shows start-only and zero-duration events without inventing an interval, rejecting malformed dates", () => {
    expect(agenda([
      event("missing", { end_at: null }), event("point", { end_at: "2026-10-17T01:30:00Z" }),
      event("no-start", { start_at: null }), event("bad", { start_at: "invalid" }),
      event("bad-end", { end_at: "invalid" }), event("reverse", { end_at: "2026-10-16T20:00:00Z" }),
      event("zero-days", { is_all_day: true, start_at: "2026-10-17", end_at: "2026-10-17" }),
    ]).map(e => e.id)).toEqual(["missing", "point"]);
  });
});
