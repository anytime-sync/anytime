import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { POST } from "./route";
let zone: string | null, inserted: any[], logged: boolean, prefError: boolean;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-03-07T20:00Z"));
  vi.stubEnv("INBOUND_EMAIL_SECRET", "fixture");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.example.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture");
  zone = "America/New_York";
  inserted = [];
  logged = false;
  prefError = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname !== "database.example.invalid")
        throw new Error("Blocked external request");
      const table = url.pathname.split("/").at(-1),
        json = (value: unknown, status = 200) =>
          new Response(JSON.stringify(value), {
            status,
            headers: { "content-type": "application/json" },
          });
      if (table === "user_inbox_aliases")
        return json({
          user_id: "owner",
          alias_local: "fixture",
          total_received: 0,
        });
      if (table === "email_inbox_log") {
        if (init?.method === "POST") {
          logged = true;
          return json(null, 201);
        }
        return json(logged ? { task_id: "task" } : null);
      }
      if (table === "user_preferences")
        return prefError
          ? json({ message: "offline" }, 400)
          : json(zone ? { timezone: zone } : null);
      if (table === "tags" || table === "projects") return json([]);
      if (table === "tasks" && init?.method === "POST") {
        inserted.push(JSON.parse(init.body));
        return json({ id: "task" });
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
const request = (Subject: string) =>
  POST(
    new Request("http://localhost/api/inbox/inbound", {
      method: "POST",
      headers: { authorization: "Bearer fixture" },
      body: JSON.stringify({
        To: "fixture@firstlight.to",
        From: "sender@example.invalid",
        Subject,
        TextBody: "Synthetic",
        MessageID: "fixture-message",
      }),
    }),
  );
it("email uses the same future-DST capture as Quick Add and keeps the existing dedup log", async () => {
  expect((await request("Review tomorrow 9am")).status).toBe(200);
  expect(inserted[0]).toMatchObject({
    due_at: "2026-03-08T13:00:00.000Z",
    schedule_timezone: "America/New_York",
    is_all_day: false,
  });
  expect(await (await request("Review tomorrow 9am")).json()).toMatchObject({
    deduped: true,
  });
  expect(inserted).toHaveLength(1);
});
it("civil email capture survives travel and preserves relative reminder intent", async () => {
  zone = "Pacific/Kiritimati";
  expect(
    (await request("Review November 10 2026 remind me 30m before")).status,
  ).toBe(200);
  expect(inserted[0]).toMatchObject({
    due_date: "2026-11-10",
    schedule_timezone: zone,
    reminder_offset_min: 30,
  });
});
it("ambiguous input or preference failure creates no task", async () => {
  expect((await request("Review November 1 2026 1:30am")).status).toBe(422);
  prefError = true;
  expect((await request("Review tomorrow")).status).toBe(503);
  expect(inserted).toHaveLength(0);
});
