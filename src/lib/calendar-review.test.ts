import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  create: vi.fn(),
  patch: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("./google-calendar", () => ({
  getCalendarEvent: mocks.get,
  createCalendarEvent: mocks.create,
  patchCalendarEvent: mocks.patch,
  deleteCalendarEvent: mocks.remove,
}));
vi.mock("./calendar-token", () => ({
  getValidAccessToken: async () => "fixture",
}));
import {
  fixtureDatabase,
  fixtureProvider,
} from "./__fixtures__/worldwide/calendar";
import { buildEventInput } from "./calendar-write";
import { eventBaseline } from "./calendar-reconcile";
import { reviewCalendarTask, acceptCalendarReview } from "./calendar-review";
let p: ReturnType<typeof fixtureProvider>,
  f: ReturnType<typeof fixtureDatabase>;
beforeEach(() => {
  vi.resetAllMocks();
  p = fixtureProvider(mocks);
  const task: any = {
    id: "task",
    user_id: "owner",
    title: "Local",
    notes: null,
    time_kind: "work",
    start_at: "2026-11-05T12:00Z",
    due_at: "2026-11-05T13:00Z",
    is_all_day: false,
    status: "open",
    calendar_event_id: "event",
    calendar_id: "primary",
    updated_at: "revision",
    calendar_dirty: true,
    calendar_conflict: { reason: "both_sides_changed" },
  };
  const event = p.save({
    ...buildEventInput(task),
    id: "event",
    location: "provider-only-location",
    attendees: [{ email: "private@example.invalid" }],
  });
  task.calendar_baseline = eventBaseline(event);
  task.calendar_etag = event.etag;
  f = fixtureDatabase([task]);
  p.save({ ...event, summary: "Remote" });
});
it("accepts the reviewed supported version into the same task without a provider mutation or private data exposure", async () => {
  const { result } = await reviewCalendarTask(f.db, "owner", "task");
  expect(result.canAcceptCalendar).toBe(true);
  expect(JSON.stringify(result)).not.toContain("provider-only-location");
  expect(JSON.stringify(result)).not.toContain("private@example.invalid");
  await acceptCalendarReview(f.db, "owner", "task", result.review);
  expect(f.tables.tasks).toHaveLength(1);
  expect(f.tables.tasks[0]).toMatchObject({
    id: "task",
    title: "Remote",
    calendar_event_id: "event",
    calendar_conflict: null,
  });
  expect(mocks.patch).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it.each(["local", "remote", "baseline"])(
  "rejects stale %s reviews",
  async (side) => {
    const { result } = await reviewCalendarTask(f.db, "owner", "task");
    if (side === "local") f.edit("task", { title: "New local" });
    if (side === "remote")
      p.save({ ...p.events.get("event"), summary: "New remote" });
    if (side === "baseline") f.tables.tasks[0].calendar_etag = "new baseline";
    await expect(
      acceptCalendarReview(f.db, "owner", "task", result.review),
    ).rejects.toThrow("changed");
    expect(f.db.rpc).not.toHaveBeenCalled();
  },
);
it("fails CAS for an edit between provider read and database persistence", async () => {
  const { result } = await reviewCalendarTask(f.db, "owner", "task");
  const original = f.db.rpc.getMockImplementation();
  f.db.rpc.mockImplementation(async (...args: any[]) => {
    f.edit("task", { title: "Newer" });
    return original(...args);
  });
  await expect(
    acceptCalendarReview(f.db, "owner", "task", result.review),
  ).rejects.toThrow("changed");
  expect(f.tables.tasks[0].title).toBe("Newer");
});
it.each([
  "recurrence",
  "legacy",
  "deleted",
  "tag",
  "mode",
  "inactive",
  "invalid-recurring",
  "invalid-native",
])("retains unsupported %s conflicts", async (reason) => {
  if (reason === "recurrence") f.tables.tasks[0].rrule = "FREQ=DAILY";
  if (reason === "legacy") f.tables.tasks[0].time_kind = null;
  if (reason === "deleted") p.events.delete("event");
  if (reason === "tag")
    p.save({
      ...p.events.get("event"),
      extendedProperties: { private: { firstlightTaskId: "other" } },
    });
  if (reason === "mode")
    p.save({
      ...p.events.get("event"),
      start: { date: "2026-11-05" },
      end: { date: "2026-11-06" },
    });
  if (reason === "inactive") f.tables.tasks[0].is_completed = true;
  if (reason === "invalid-recurring") {
    f.tables.tasks[0].rrule = "FREQ=DAILY";
    f.tables.tasks[0].due_at = null;
  }
  if (reason === "invalid-native") f.tables.tasks[0].due_at = null;
  const { result } = await reviewCalendarTask(f.db, "owner", "task");
  expect(result.canAcceptCalendar).toBe(false);
  await expect(
    acceptCalendarReview(f.db, "owner", "task", result.review),
  ).rejects.toThrow("manual review");
  expect(f.tables.tasks[0].calendar_conflict).not.toBeNull();
});
it("rejects a shared reader or a different account before fetching the provider", async () => {
  await expect(
    reviewCalendarTask(f.db, "shared-reader", "task"),
  ).rejects.toThrow("not found");
  expect(mocks.get).not.toHaveBeenCalled();
});
it("acceptance also replaces a local-only schedule change instead of acknowledging a mixed version", async () => {
  f.edit("task", {
    start_at: "2026-11-05T14:00Z",
    due_at: "2026-11-05T15:00Z",
  });
  const { result } = await reviewCalendarTask(f.db, "owner", "task");
  await acceptCalendarReview(f.db, "owner", "task", result.review);
  expect(f.tables.tasks[0]).toMatchObject({
    title: "Remote",
    start_at: "2026-11-05T12:00:00.000Z",
    due_at: "2026-11-05T13:00:00.000Z",
    calendar_dirty: false,
  });
});
it("does not accept a local mode change as a harmless title conflict", async () => {
  f.edit("task", { time_kind: "deadline", is_all_day: true });
  expect(
    (await reviewCalendarTask(f.db, "owner", "task")).result.canAcceptCalendar,
  ).toBe(false);
});
