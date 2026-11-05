import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ email: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/resend", () => ({
  getResend: () => ({ emails: { send: mocks.email } }),
  getFromAddress: () => "fixture@example.invalid",
}));
vi.mock("@/lib/unsub-token", () => ({ makeUnsubToken: () => "fixture" }));
vi.mock("@/lib/feature-flags", () => ({
  getEffectiveFeature: async () => ({ enabled: true }),
}));
vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: mocks.push },
}));
import { GET } from "./route";
let task: any, pref: any, queries: URL[], failPrefs: boolean;
beforeEach(() => {
  mocks.email.mockReset().mockResolvedValue({});
  mocks.push.mockReset();
  queries = [];
  failPrefs = false;
  for (const [key, value] of Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: "https://database.example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "fixture",
    CRON_SECRET: "fixture",
    VAPID_PUBLIC_KEY: "fixture",
    VAPID_PRIVATE_KEY: "fixture",
  }))
    vi.stubEnv(key, value);
  task = {
    id: "task",
    user_id: "00000000-0000-4000-8000-000000000001",
    title: "Fixture",
    time_kind: "deadline",
    due_at: "2026-11-05T16:00Z",
    due_date: "2026-11-06",
    is_all_day: true,
    schedule_timezone: "Asia/Taipei",
  };
  pref = {
    user_id: "00000000-0000-4000-8000-000000000001",
    language: "en",
    timezone: "Pacific/Pago_Pago",
    email_reminders: true,
    push_reminders: false,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname !== "database.example.invalid")
        throw new Error("Blocked external request");
      queries.push(url);
      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { "content-type": "application/json" },
        });
      if (url.pathname.includes("/auth/v1/admin/users/"))
        return json({
          id: "00000000-0000-4000-8000-000000000001",
          email: "fixture@example.invalid",
        });
      const table = url.pathname.split("/").at(-1);
      if (table === "tasks")
        return json(init?.method === "PATCH" ? [{ id: "task" }] : [task]);
      if (table === "user_preferences")
        return failPrefs ? json({ message: "offline" }, 400) : json([pref]);
      if (table === "push_subscriptions")
        return json([
          {
            user_id: "00000000-0000-4000-8000-000000000001",
            endpoint: "https://push.example.invalid",
            p256dh: "fixture",
            auth: "fixture",
          },
        ]);
      throw new Error("Unexpected fixture request " + url.pathname);
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const request = () =>
  GET(
    new Request("http://localhost/api/reminders/dispatch", {
      headers: { authorization: "Bearer fixture" },
    }),
  );
it("keeps civil dates floating, labels zone mismatch and honors push opt-out", async () => {
  expect((await request()).status).toBe(200);
  expect(mocks.email).toHaveBeenCalledOnce();
  expect(mocks.push).not.toHaveBeenCalled();
  const html = mocks.email.mock.calls[0][0].html;
  expect(html).toContain("Nov 6, 2026");
  expect(html).not.toMatch(/\d:\d{2}/);
  expect(html).toContain("account: Pacific/Pago_Pago; schedule: Asia/Taipei");
  expect(
    queries
      .find((q) => q.pathname.endsWith("/user_preferences"))!
      .searchParams.get("select"),
  ).toContain("push_reminders");
  expect(
    queries
      .find((q) => q.pathname.endsWith("/tasks"))!
      .searchParams.get("select"),
  ).toContain("due_date");
});
it("renders an explicit midnight instant in the account fractional-offset zone", async () => {
  task = {
    ...task,
    due_date: null,
    due_at: "2026-11-05T18:15Z",
    is_all_day: false,
    schedule_timezone: "Asia/Kathmandu",
  };
  pref.timezone = "Asia/Kathmandu";
  await request();
  expect(mocks.email.mock.calls[0][0].html).toContain("Nov 6, 2026, 12:00 AM");
});
it("preference read failure sends nothing and claims nothing", async () => {
  failPrefs = true;
  expect((await request()).status).toBe(503);
  expect(mocks.email).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
});
