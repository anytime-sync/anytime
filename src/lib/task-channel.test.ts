import { afterEach, expect, it, vi } from "vitest";
import {
  parseChannelTask,
  channelTaskFilter,
  accountTimezone,
} from "./task-channel";
import { taskNotificationDate } from "./task-notification";
import { dayWindow } from "./day-window";
import { fixtureDatabase } from "./__fixtures__/worldwide/calendar";
afterEach(() => vi.useRealTimers());
it.each([
  "Asia/Kathmandu",
  "Australia/Lord_Howe",
  "America/New_York",
  "Pacific/Kiritimati",
  "Pacific/Pago_Pago",
])("cross-channel civil capture/render/reload keeps the date in %s", (zone) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-05T12:00Z"));
  const task = parseChannelTask("Review November 10 2026", zone);
  expect(task.due_date).toBe("2026-11-10");
  expect(task.is_all_day).toBe(true);
  const label = taskNotificationDate(
    JSON.parse(JSON.stringify(task)),
    "Pacific/Pago_Pago",
  );
  expect(label).toContain("Nov 10, 2026");
  expect(label).not.toMatch(/AM|PM/);
});
it.each([null, "", "invalid-zone", "UTC"])(
  "uses UTC explicitly for missing/invalid preference %s",
  async (timezone) => {
    const f = fixtureDatabase();
    f.tables.user_preferences[0].timezone = timezone;
    expect(await accountTimezone(f.db, "owner")).toBe("UTC");
  },
);
it("preference failure blocks capture instead of changing its zone", async () => {
  const f = fixtureDatabase();
  f.state.fail = "user_preferences:read";
  await expect(accountTimezone(f.db, "owner")).rejects.toThrow(
    "timezone unavailable",
  );
});
it.each(["2026-03-08", "2026-11-01"])(
  "query uses half-open DST windows with work overlap and civil spans on %s",
  (date) => {
    const win = dayWindow(date, "America/New_York"),
      filter = channelTaskFilter(date, "America/New_York");
    expect(filter).toContain(
      `start_at.lt.${win.nextStart.toISOString()},due_at.gt.${win.start.toISOString()}`,
    );
    expect(filter).toContain(`due_date.gte.${date}`);
    expect(filter).not.toContain(".lte.");
  },
);
it("renders explicit midnight and cross-midnight work in account zone and shows pinned schedule-zone mismatch", () => {
  const label = taskNotificationDate(
    {
      time_kind: "work",
      is_all_day: false,
      start_at: "2026-11-05T18:15Z",
      due_at: "2026-11-05T19:15Z",
      schedule_timezone: "Asia/Taipei",
    },
    "Asia/Kathmandu",
  );
  expect(label).toContain("Nov 6, 2026, 12:00 AM");
  expect(label).toContain("1:00 AM");
  expect(label).toContain("account: Asia/Kathmandu; schedule: Asia/Taipei");
});
it("rejects new ambiguous or nonexistent local input without a fallback unscheduled capture", () => {
  expect(() =>
    parseChannelTask("Review March 8 2026 2:30am", "America/New_York"),
  ).toThrow();
  expect(() =>
    parseChannelTask("Review November 1 2026 1:30am", "America/New_York"),
  ).toThrow();
});
it.each([
  ["UTC", "2026-03-08T02:30:00.000Z"],
  ["Asia/Kathmandu", "2026-03-07T20:45:00.000Z"],
])(
  "keeps 02:30 in %s even when that clock time is a gap on the host",
  (zone, expected) => {
    expect(parseChannelTask("Review March 8 2026 2:30am", zone).due_at).toBe(
      expected,
    );
  },
);
it("an explicit UTC offset stays an instant even during the host/account DST gap", () => {
  expect(
    parseChannelTask("Review March 8 2026 2:30am UTC", "America/New_York")
      .due_at,
  ).toBe("2026-03-08T02:30:00.000Z");
});

it("preserves explicit instant precision and rejects a relative account DST gap", () => {
  expect(
    parseChannelTask("Review 2026-11-05T09:00:35Z", "Asia/Taipei").due_at,
  ).toBe("2026-11-05T09:00:35.000Z");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-03-07T18:00Z"));
  expect(() =>
    parseChannelTask("Review tomorrow 2:30am", "America/New_York"),
  ).toThrow();
});
