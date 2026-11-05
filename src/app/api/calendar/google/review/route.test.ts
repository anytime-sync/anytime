import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: "owner" as string | null,
  db: null as any,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.user ? { id: state.user } : null },
      }),
    },
  }),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => state.db }));
vi.mock("@/lib/calendar-token", () => ({
  getValidAccessToken: async () => {
    throw new Error("Unexpected provider access");
  },
}));
import { fixtureDatabase } from "@/lib/__fixtures__/worldwide/calendar";
import { GET, POST } from "./route";
let fixture: ReturnType<typeof fixtureDatabase>;
beforeEach(() => {
  state.user = "owner";
  fixture = fixtureDatabase([
    { id: "mine", user_id: "owner", title: "Mine", calendar_dirty: true },
    {
      id: "theirs",
      user_id: "other",
      title: "Other private task",
      calendar_conflict: { reason: "both_sides_changed" },
    },
  ]);
  state.db = fixture.db;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:9");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fixture");
});
afterEach(() => vi.unstubAllEnvs());
it("lists only the signed-in owner and queries actionable pending work", async () => {
  const response = await GET(
    new Request("http://localhost/api/calendar/google/review"),
  );
  expect(await response.json()).toMatchObject({ items: [{ id: "mine" }] });
  expect(fixture.reads[0].filters).toContainEqual(["eq", "user_id", "owner"]);
  expect(fixture.reads[0].filters.find((f: any) => f[0] === "or")[1]).toContain(
    "start_at.not.is.null",
  );
});
it("rejects unauthenticated requests before service queries", async () => {
  state.user = null;
  expect(
    (await GET(new Request("http://localhost/api/calendar/google/review")))
      .status,
  ).toBe(401);
  expect(fixture.reads).toHaveLength(0);
});
it("shared-task readers cannot resolve the owner’s calendar or smuggle another user id", async () => {
  const response = await POST(
    new Request("http://localhost/api/calendar/google/review", {
      method: "POST",
      body: JSON.stringify({
        taskId: "theirs",
        userId: "other",
        choice: "calendar",
        review: "a".repeat(64),
      }),
    }),
  );
  expect(response.status).toBe(404);
  expect(fixture.writes).toHaveLength(0);
});
