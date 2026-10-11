import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { autoImplementMethods } from "next/dist/server/future/route-modules/app-route/helpers/auto-implement-methods";
import * as route from "./route";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CRON_SECRET", "test-secret");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function request(authorization?: string, method = "POST") {
  return new NextRequest("https://firstlight.test/api/gsc/ping", {
    method,
    headers: authorization ? { authorization } : {},
  });
}

describe("GSC ping authorization", () => {
  it.each([
    [undefined, undefined],
    [undefined, "Bearer undefined"],
    ["", "Bearer "],
    ["   ", "Bearer    "],
    ["test-secret", undefined],
    ["test-secret", "Bearer wrong"],
    ["test-secret", "Bearer test-secreu"],
  ])("rejects secret %j with header %j before any submissions", async (secret, header) => {
    vi.stubEnv("CRON_SECRET", secret);
    const response = await route.POST(request(header));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves both sites' submissions for a valid bearer secret", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 200 }));
    const response = await route.POST(request("Bearer test-secret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      firstlight_indexnow: { status: 200, ok: true },
      oqua_indexnow: { status: 200, ok: true },
      google_fl: { status: 200 },
      google_oqua: { status: 200 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (const [index, host] of [[0, "firstlight.to"], [1, "www.oqua.com"]] as const) {
      expect(fetchMock.mock.calls[index][0]).toBe("https://api.indexnow.org/indexnow");
      expect(fetchMock.mock.calls[index][1]!.method).toBe("POST");
      const payload = JSON.parse(fetchMock.mock.calls[index][1]!.body as string);
      expect(payload.host).toBe(host);
      expect(payload.urlList).toContain(`https://${host}/`);
    }
  });

  it("keeps the public GET informational and side-effect free", async () => {
    const response = await route.GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("message");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["PUT", "PATCH", "DELETE"] as const)(
    "lets Next.js reject unsupported %s requests without external calls",
    async (method) => {
      const methods = autoImplementMethods(route);
      for (const header of [undefined, "Bearer test-secret"]) {
        const response = await methods[method](request(header, method), {}) as Response;
        expect(response.status).toBe(405);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(["HEAD", "OPTIONS"] as const)("keeps automatic %s side-effect free", async (method) => {
    const response = await autoImplementMethods(route)[method](request(undefined, method), {}) as Response;
    expect(response.status).toBe(method === "HEAD" ? 200 : 204);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
