import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  requireAdmin: vi.fn(),
  createClient: vi.fn(),
  from: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/admin-server", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
import { GET, POST } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
  mocks.headers.mockReturnValue(new Headers());
  mocks.requireAdmin.mockResolvedValue({ ok: false, status: 401, error: "unauthorized" });
  mocks.from.mockReturnValue({
    select: () => ({ eq: async () => ({ data: [], error: null }) }),
  });
  mocks.createClient.mockReturnValue({ from: mocks.from });
});
afterEach(() => vi.unstubAllEnvs());

describe.each([GET, POST])("keyword reclassification %s authorization", (handler) => {
  it.each([
    [undefined, undefined],
    [undefined, "Bearer undefined"],
    ["", "Bearer "],
    ["   ", "Bearer    "],
    ["test-secret", undefined],
    ["test-secret", "Bearer wrong"],
    ["test-secret", "Bearer test-secreu"],
  ])("rejects an anonymous caller with secret %j and header %j", async (secret, header) => {
    vi.stubEnv("CRON_SECRET", secret);
    // This metadata is not proof of authorization.
    mocks.headers.mockReturnValue(new Headers({ "x-vercel-cron": "1", ...(header ? { authorization: header } : {}) }));
    const response = await handler();
    expect(response.status).toBe(401);
    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("allows a valid cron bearer without requiring an admin session", async () => {
    mocks.headers.mockReturnValue(new Headers({ authorization: "Bearer test-secret" }));
    const response = await handler();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, scanned: 0, updated: 0 });
    expect(mocks.requireAdmin).not.toHaveBeenCalled();
    expect(mocks.createClient).toHaveBeenCalledOnce();
  });

  it.each([undefined, "", "test-secret"])(
    "preserves authenticated admin access without a cron header (secret %j)",
    async (secret) => {
      vi.stubEnv("CRON_SECRET", secret);
      mocks.requireAdmin.mockResolvedValue({ ok: true, ctx: { admin: { from: mocks.from } } });
      const response = await handler();
      expect(response.status).toBe(200);
      expect(mocks.requireAdmin).toHaveBeenCalledOnce();
      expect(mocks.createClient).not.toHaveBeenCalled();
      expect(mocks.from).toHaveBeenCalledWith("tasks");
    },
  );

  it("preserves the forbidden response for a non-admin session", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, status: 403, error: "forbidden" });
    expect((await handler()).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
