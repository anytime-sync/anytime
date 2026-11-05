import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/telegram", () => ({
  sendMessage: mocks.send,
  isBotConfigured: () => true,
  verifyWebhookSecret: () => true,
}));
import { POST } from "./route";
let zone: string | null,
  inserted: any[],
  queries: URL[],
  tasks: any[],
  rpc: any[];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-03-07T20:00:00Z"));
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.example.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture-only");
  zone = "America/New_York";
  inserted = [];
  queries = [];
  tasks = [];
  rpc = [];
  mocks.send.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname !== "database.example.invalid")
        throw new Error("Blocked external request");
      queries.push(url);
      const table = url.pathname.split("/").at(-1);
      const json = (v: unknown) =>
        new Response(JSON.stringify(v), {
          headers: { "content-type": "application/json" },
        });
      if (table === "user_telegram_links") return json({ user_id: "owner" });
      if (table === "user_preferences")
        return json(zone === null ? null : { timezone: zone });
      if (table === "complete_task_occurrence") {
        rpc.push(JSON.parse(init.body));
        return json({ data: tasks[0], recurring: true });
      }
      if (table === "tasks") {
        if (init?.method === "POST") {
          const row = JSON.parse(init.body);
          inserted.push(row);
          return json({ ...row, id: "task", updated_at: "revision" });
        }
        if (init?.method === "PATCH")
          throw new Error("Independent completion writes are forbidden");
        return json(url.searchParams.has("id") ? tasks[0] : tasks);
      }
      throw new Error("Unexpected fixture table " + table);
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const command = (text: string) =>
  POST(
    new NextRequest("http://localhost/api/telegram/webhook", {
      method: "POST",
      body: JSON.stringify({
        message: { text, from: { id: 1 }, chat: { id: 1 }, message_id: 1 },
      }),
    }),
  );
it("captures future DST using account IANA and keeps explicit midnight timed", async () => {
  await command("/add Review tomorrow at midnight");
  expect(inserted[0]).toMatchObject({
    due_at: "2026-03-08T05:00:00.000Z",
    is_all_day: false,
    schedule_timezone: "America/New_York",
  });
  await command("/add Review tomorrow 9am");
  expect(inserted[1].due_at).toBe("2026-03-08T13:00:00.000Z");
});
it("queries an account day with civil-date and overlapping-work alternatives", async () => {
  await command("/today");
  const q = queries.find((u) => u.pathname.endsWith("/tasks"))!;
  expect(q.searchParams.get("or")).toContain("due_date");
  expect(q.searchParams.get("or")).toContain("2026-03-07T05:00:00.000Z");
});
it("retains the listed exact revision when completing a recurring task", async () => {
  tasks = [
    {
      id: "task",
      user_id: "owner",
      title: "Repeat",
      time_kind: "deadline",
      due_at: "2026-03-07T14:00:00Z",
      is_all_day: false,
      rrule: "FREQ=DAILY;COUNT=2",
      updated_at: "2026-03-07T12:00:00.123456Z",
      status: "open",
    },
  ];
  await command("/week");
  await command("/done 1");
  expect(rpc).toHaveLength(1);
  expect(rpc[0].p_expected_updated_at).toBe(tasks[0].updated_at);
  expect(rpc[0].p_next.due_at).toBe("2026-03-08T13:00:00.000Z");
});
