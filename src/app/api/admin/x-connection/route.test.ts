import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), query: vi.fn(), verifyX: vi.fn() }));
vi.mock("@/lib/admin-server", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/x-connection", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/x-connection")>(), verifyX: mocks.verifyX }));
import { GET, POST } from "./route";
import { GET as retired } from "../../x-oauth/route";
const rows = ["X_CONSUMER_KEY", "X_CONSUMER_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"].map((key) => ({ key, value: "private-" + key }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue({ data: rows, error: null });
  mocks.requireAdmin.mockResolvedValue({ ok: true, ctx: { admin: { from: () => ({ select: () => ({ in: mocks.query }) }) } } });
});
describe("admin X connection", () => {
  it("rejects unauthorized users before reading credentials", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, status: 401, error: "unauthorized" });
    expect((await GET()).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("returns only readiness metadata and never makes an automatic X call", async () => {
    const response = await GET();
    const body = await response.text();
    expect(body).toContain('"configured":true');
    expect(body).not.toContain("private-");
    expect(mocks.verifyX).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("fails closed if the credential store is unavailable", async () => {
    mocks.query.mockResolvedValue({ data: null, error: { message: "private-provider-details" } });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-provider-details");
  });
  it("blocks cross-origin checks before privileged reads", async () => {
    const response = await POST(new NextRequest("https://firstlight.to/api/admin/x-connection", { method: "POST", headers: { origin: "https://other.example" } }));
    expect(response.status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("returns the live check without returning credentials", async () => {
    mocks.verifyX.mockResolvedValue({ state: "credits_required", httpStatus: 402 });
    const response = await POST(new NextRequest("https://firstlight.to/api/admin/x-connection", { method: "POST", headers: { origin: "https://firstlight.to" } }));
    expect((await response.json()).state).toBe("credits_required");
  });
  it("retired callback cannot exchange, reflect or log credentials", async () => {
    const spy = vi.spyOn(console, "log");
    const response = await retired();
    expect(response.status).toBe(410);
    expect(response.headers.get("Content-Type")).toContain("text/plain");
    expect(await response.text()).not.toContain("Authorized");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
