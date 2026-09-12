import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/lib/admin-server", () => ({ requireAdmin: mocks.auth }));
vi.mock("@/lib/x-promotion", () => ({ dispatchPromotion: mocks.dispatch, PROMOTION_HOURS: {} }));
import { GET, POST } from "./route";
describe("promotion admin authorization", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("VERCEL_ENV", "production"); });
  it("denies anonymous reads and publishes", async () => {
    mocks.auth.mockResolvedValue({ ok: false, status: 401, error: "unauthorized" });
    expect((await GET()).status).toBe(401);
    expect((await POST(new NextRequest("https://firstlight.to/api/admin/x-promotion", { method: "POST", headers: { origin: "https://firstlight.to" }, body: '{"action":"dispatch"}' }))).status).toBe(401);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("rejects cross-origin mutations before credentials are accessed", async () => {
    expect((await POST(new NextRequest("https://firstlight.to/api/admin/x-promotion", { method: "POST", headers: { origin: "https://evil.test" } }))).status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("prevents preview deployments from publishing", async () => {
    vi.stubEnv("VERCEL_ENV", "preview"); mocks.auth.mockResolvedValue({ ok: true, ctx: { admin: {} } });
    expect((await POST(new NextRequest("https://firstlight.to/api/admin/x-promotion", { method: "POST", headers: { origin: "https://firstlight.to" }, body: '{"action":"dispatch"}' }))).status).toBe(403);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
