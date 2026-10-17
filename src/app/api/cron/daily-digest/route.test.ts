import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DigestCalendarEvent } from "@/lib/email/digest-agenda";
import type { DigestTask } from "@/lib/email/daily-digest-template";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/resend", () => ({ getResend: () => ({ emails: { send: mocks.send } }), getFromAddress: () => "test@example.invalid" }));
vi.mock("@/lib/unsub-token", () => ({ makeUnsubToken: () => "test-only-token" }));

import { GET } from "./route";

type Call = { url: URL; method: string; body?: string };
let calls: Call[];
let events: DigestCalendarEvent[];
let dueToday: DigestTask[];
let overdue: DigestTask[];
let timezone: string;
let language: string;
let calendarErrorOffset: number | null;
let taskError: boolean;
let alreadySent: boolean;
let recipients: string[];
let eventsByUser: Record<string, DigestCalendarEvent[]> | null;
let tasksByUser: Record<string, DigestTask[]> | null;

const event = (id: string, overrides: Partial<DigestCalendarEvent> = {}): DigestCalendarEvent => ({
  id, title: id, start_at: "2026-10-17T01:30:00+00:00", end_at: "2026-10-17T04:30:00+00:00",
  is_all_day: false, cancelled: false, status: "confirmed", task_id: null, ...overrides,
});

const request = () => GET(new Request("https://firstlight.test/api/cron/daily-digest", {
  headers: { authorization: "Bearer test-cron-secret" },
}));
const calendarCalls = () => calls.filter(c => c.url.pathname.endsWith("/calendar_events"));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T23:00:00Z"));
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-service-key");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.example.invalid");
  vi.stubEnv("APP_URL", "https://firstlight.test");
  mocks.send.mockReset().mockResolvedValue({ data: { id: "test-email-id" }, error: null });
  calls = []; events = []; dueToday = []; overdue = [];
  timezone = "Asia/Taipei"; language = "en";
  calendarErrorOffset = null; taskError = false; alreadySent = false;
  recipients = ["recipient"]; eventsByUser = null; tasksByUser = null;

  // Exercise the real Supabase query builder while intercepting every HTTP
  // request. The mail provider is also mocked; no real recipient is contacted.
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname !== "database.example.invalid") throw new Error(`Unexpected test request: ${url.origin}`);
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: typeof init?.body === "string" ? init.body : undefined });
    const table = url.pathname.split("/").at(-1);
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
    switch (table) {
      case "user_preferences":
        return json(recipients.map(user_id => ({ user_id, language, timezone, digest_send_hour: 7, email_daily_digest: true })));
      case "daily_digest_log":
        return method === "POST" ? new Response(null, { status: 201 }) : json(alreadySent ? { user_id: "recipient" } : null);
      case "profiles": return json({ email: `${url.searchParams.get("id")?.slice(3)}@example.invalid`, full_name: "Reader" });
      case "tasks":
        if (taskError) return json({ message: "tasks unavailable" }, 400);
        return json(url.searchParams.getAll("due_at").some(v => v.startsWith("gte."))
          ? scopedRows(tasksByUser, url, dueToday) : overdue);
      case "calendar_events": {
        const offset = Number(url.searchParams.get("offset") ?? 0);
        if (calendarErrorOffset !== null && offset >= calendarErrorOffset) return json({ message: "calendar unavailable" }, 400);
        return json(scopedRows(eventsByUser, url, events).slice(offset, offset + Number(url.searchParams.get("limit"))));
      }
      case "habit_logs": return method === "HEAD"
        ? new Response(null, { headers: { "content-range": "*/0" } }) : json([]);
      default: throw new Error(`Unexpected table: ${table}`);
    }
  }));
});

function scopedRows<T>(byUser: Record<string, T[]> | null, url: URL, fallback: T[]): T[] {
  if (!byUser) return fallback;
  const owner = url.searchParams.get("user_id")?.slice(3);
  // Missing ownership filters expose every fixture, as a service-role query
  // would. A regression therefore leaks titles and fails the email assertions.
  return owner ? byUser[owner] ?? [] : Object.values(byUser).flat();
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("daily digest calendar integration", () => {
  it("includes the reported Taipei occurrence in both MIME alternatives and logs the local date", async () => {
    events = [event("Calendar lesson")];
    const response = await request();
    expect(await response.json()).toMatchObject({ sent: [{ user_id: "recipient", status: "ok" }] });
    expect(mocks.send).toHaveBeenCalledOnce();
    const email = mocks.send.mock.calls[0][0];
    for (const body of [email.html, email.text]) {
      expect(body).toContain("Calendar lesson");
      expect(body).toContain("9:30 AM – 12:30 PM");
      expect(body).toContain("Saturday, October 17");
    }
    const query = calendarCalls()[0].url.searchParams;
    expect(query.get("user_id")).toBe("eq.recipient");
    expect(query.get("cancelled")).toBe("eq.false");
    expect(query.getAll("or")[0]).toBe("(status.is.null,status.neq.cancelled)");
    expect(query.getAll("or")[1]).toContain("start_at.lt.2026-10-17T16:00:00.000Z");
    expect(query.getAll("or")[1]).toContain("end_at.gt.2026-10-16T16:00:00.000Z");
    expect(query.getAll("or")[1]).toContain("is_all_day.eq.true,start_at.lt.2026-10-18T00:00:00.000Z");
    expect(query.getAll("or")[1]).toContain("end_at.gt.2026-10-17T00:00:00.000Z");
    expect(query.get("order")).toBe("start_at.asc,id.asc");
    const log = calls.find(c => c.method === "POST" && c.url.pathname.endsWith("/daily_digest_log"));
    expect(JSON.parse(log!.body!)).toMatchObject({ user_id: "recipient", sent_for_date: "2026-10-17" });
  });

  it.each([
    ["2026-03-08T11:00:00Z", "2026-03-08T05:00:00.000Z", "2026-03-09T04:00:00.000Z"],
    ["2026-11-01T12:00:00Z", "2026-11-01T04:00:00.000Z", "2026-11-02T05:00:00.000Z"],
  ])("queries recipient-local DST boundaries at %s", async (now, start, end) => {
    timezone = "America/New_York";
    vi.setSystemTime(new Date(now));
    await request();
    const filter = calendarCalls()[0].url.searchParams.getAll("or")[1];
    expect(filter).toContain(`end_at.gt.${start}`);
    expect(filter).toContain(`start_at.lt.${end}`);
  });

  it("keeps urgent/top/overdue selection and deduplicates only tasks actually displayed", async () => {
    dueToday = Array.from({ length: 10 }, (_, i) => ({ id: `task-${i}`, title: `Task ${i}`, due_at: "2026-10-17T02:00:00Z", priority: i < 6 ? 4 : 1 }));
    overdue = [{ id: "old-task", title: "Old task", due_at: "2026-10-15T02:00:00Z", priority: 1 }];
    events = [event("Urgent copy", { task_id: "task-0" }), event("Top copy", { task_id: "task-5" }),
      event("Overdue copy", { task_id: "old-task" }), event("Outside email cap", { task_id: "task-8" }),
      event("Non-displayed linked task", { task_id: "not-in-task-query" }), event("Independent appointment")];
    await request();
    for (const body of [mocks.send.mock.calls[0][0].html, mocks.send.mock.calls[0][0].text]) {
      for (const title of ["Urgent copy", "Top copy", "Overdue copy", "Task 8", "Task 9"]) expect(body).not.toContain(title);
      for (const title of ["Task 0", "Task 7", "Old task", "Outside email cap", "Non-displayed linked task", "Independent appointment"]) expect(body).toContain(title);
    }
    const taskQueries = calls.filter(c => c.url.pathname.endsWith("/tasks"));
    for (const { url } of taskQueries) {
      expect(url.searchParams.get("user_id")).toBe("eq.recipient");
      expect(url.searchParams.get("is_completed")).toBe("eq.false");
      expect(url.searchParams.get("status")).toBe("neq.archived");
    }
    expect(taskQueries.map(c => c.url.searchParams.get("limit"))).toEqual(["20", "5"]);
  });

  it("reads every calendar page before sending, including the final stored recurrence instance", async () => {
    events = Array.from({ length: 201 }, (_, i) => event(`Occurrence ${i}`));
    await request();
    expect(calendarCalls().map(c => c.url.searchParams.get("offset"))).toEqual(["0", "200"]);
    const email = mocks.send.mock.calls[0][0];
    expect(email.html).toContain("Occurrence 200");
    expect(email.text).toContain("Occurrence 200");
  });

  it("does not render the calendar owner's declined invitation or attendee metadata in either email", async () => {
    events = [
      event("Declined invitation", { attendees: [{ self: true, responseStatus: "declined", email: "connected-google@example.invalid" }] }),
      event("Accepted invitation", { attendees: [{ self: true, responseStatus: "accepted", email: "connected-google@example.invalid" }, { responseStatus: "declined", email: "other-attendee@example.invalid" }] }),
    ];
    await request();
    const query = calendarCalls()[0].url.searchParams;
    expect(query.get("select")).toContain("attendees:raw->attendees");
    const email = mocks.send.mock.calls[0][0];
    for (const body of [email.html, email.text]) {
      expect(body).not.toContain("Declined invitation");
      expect(body).toContain("Accepted invitation");
      expect(body).not.toContain("connected-google@example.invalid");
      expect(body).not.toContain("other-attendee@example.invalid");
    }
  });

  it("isolates every page and displayed-task set between recipients in the same cron run", async () => {
    recipients = ["alice", "bob"];
    tasksByUser = { alice: [{ id: "alice-task", title: "Alice private task", due_at: "2026-10-17T02:00:00Z", priority: 4 }], bob: [] };
    eventsByUser = {
      alice: [event("Alice task copy", { task_id: "alice-task" }), ...Array.from({ length: 200 }, (_, i) => event(`Alice appointment ${i}`))],
      // A foreign task link must never join to/disclose another user's task or
      // suppress this user's event based on the previous recipient's payload.
      bob: [event("Bob appointment", { task_id: "alice-task" })],
    };
    await request();
    expect(mocks.send).toHaveBeenCalledTimes(2);
    const [alice, bob] = mocks.send.mock.calls.map(([email]) => email);
    expect(alice.to).toBe("alice@example.invalid");
    expect(bob.to).toBe("bob@example.invalid");
    for (const body of [alice.html, alice.text]) {
      expect(body).toContain("Alice private task");
      expect(body).toContain("Alice appointment 199");
      expect(body).not.toContain("Alice task copy");
      expect(body).not.toContain("Bob appointment");
    }
    for (const body of [bob.html, bob.text]) {
      expect(body).toContain("Bob appointment");
      expect(body).not.toContain("Alice");
    }
    expect(calendarCalls().map(c => [c.url.searchParams.get("user_id"), c.url.searchParams.get("offset")]))
      .toEqual([["eq.alice", "0"], ["eq.alice", "200"], ["eq.bob", "0"]]);
    expect(calls.filter(c => c.url.pathname.endsWith("/tasks")).map(c => c.url.searchParams.get("user_id")))
      .toEqual(["eq.alice", "eq.alice", "eq.bob", "eq.bob"]);
    expect(calls.filter(c => c.method === "POST").map(c => JSON.parse(c.body!).user_id)).toEqual(["alice", "bob"]);
  });

  it.each([0, 200])("does not send or mark a partial agenda as delivered when page %s fails", async offset => {
    events = Array.from({ length: 201 }, (_, i) => event(`Occurrence ${i}`));
    calendarErrorOffset = offset;
    expect(await (await request()).json()).toMatchObject({ sent: [{ status: "calendar_query_error", detail: "calendar unavailable" }] });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(calls.filter(c => c.method === "POST")).toHaveLength(0);
  });

  it("preserves the task-query failure path without sending", async () => {
    taskError = true;
    expect(await (await request()).json()).toMatchObject({ sent: [{ status: "task_query_error" }] });
    expect(mocks.send).not.toHaveBeenCalled();
    expect(calendarCalls()).toHaveLength(0);
  });

  it("keeps the already-sent and recipient-hour guards", async () => {
    alreadySent = true;
    await request();
    expect(calendarCalls()).toHaveLength(0);
    expect(mocks.send).not.toHaveBeenCalled();
    calls = []; alreadySent = false;
    vi.setSystemTime(new Date("2026-10-17T00:00:00Z"));
    await request();
    expect(calls).toHaveLength(1);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it.each([
    ["en", "Today's calendar", "All day", "Untitled event"],
    ["zh-TW", "今日行事曆", "全天", "未命名活動"],
    ["zh-CN", "今日日历", "全天", "未命名活动"],
    ["ja", "今日のカレンダー", "終日", "無題の予定"],
    ["ko", "오늘의 캘린더", "종일", "제목 없는 일정"],
  ])("provides calendar labels in %s in both formats", async (lang, section, allDay, untitled) => {
    language = lang;
    events = [event("untitled", { title: null, is_all_day: true, start_at: "2026-10-17", end_at: "2026-10-18" })];
    await request();
    const email = mocks.send.mock.calls[0][0];
    expect(email.text).toContain(section.toUpperCase());
    expect(email.html).toContain(section.replace("'", "&#39;"));
    for (const body of [email.html, email.text]) {
      expect(body).toContain(allDay);
      expect(body).toContain(untitled);
    }
  });
});
