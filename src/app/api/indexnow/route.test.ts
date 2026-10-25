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
  vi.restoreAllMocks();
});

function request(authorization?: string, body?: string, method = "POST") {
  return new NextRequest("https://firstlight.test/api/indexnow", {
    method,
    headers: authorization ? { authorization } : {},
    body,
  });
}

describe("IndexNow authorization", () => {
  it.each([
    [undefined, undefined],
    [undefined, "Bearer undefined"],
    [undefined, "Bearer test-secret"],
    ["", undefined],
    ["", "Bearer "],
    ["   ", "Bearer    "],
    ["test-secret", undefined],
    ["test-secret", "Bearer wrong"],
    ["test-secret", "Bearer test-secreu"],
    ["test-secret", "Basic test-secret"],
  ])("rejects secret %j with header %j before any work", async (secret, header) => {
    vi.stubEnv("CRON_SECRET", secret);
    const req = request(header, '{"urls":["https://firstlight.test/private"]}');
    const readBody = vi.spyOn(req, "json");
    const response = await route.POST(req);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(readBody).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([undefined, "invalid json", JSON.stringify({ urls: ["https://firstlight.to/blog"] })])(
    "preserves authenticated submissions with body %j",
    async (body) => {
      fetchMock.mockResolvedValueOnce(new Response("accepted", { status: 202 }));
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

      const response = await route.POST(request("Bearer test-secret", body));
      const payload = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.indexnow.org/indexnow");
      expect(fetchMock.mock.calls[0][1]!.method).toBe("POST");
      expect(payload.host).toBe("firstlight.to");
      if (body?.startsWith("{")) {
        expect(payload.urlList).toEqual(["https://firstlight.to/blog"]);
      } else {
        expect(payload.urlList).toHaveLength(11);
        expect(payload.urlList).toContain("https://firstlight.to/pricing");
      }
      expect(fetchMock.mock.calls[1][0]).toBe(
        "https://www.google.com/ping?sitemap=https%3A%2F%2Ffirstlight.to%2Fsitemap.xml",
      );
      expect(await response.json()).toEqual({
        indexnow: { status: 202, body: "accepted" },
        googlePing: 200,
        urlsSubmitted: payload.urlList.length,
      });
    },
  );

  it.each(["GET", "HEAD", "PUT", "PATCH", "DELETE"] as const)(
    "lets Next.js reject unsupported %s requests without external calls",
    async (method) => {
      const methods = autoImplementMethods(route);
      for (const header of [undefined, "Bearer test-secret"]) {
        const response = await methods[method](request(header, undefined, method), {}) as Response;
        expect(response.status).toBe(405);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("keeps automatic OPTIONS side-effect free", async () => {
    const response = await autoImplementMethods(route).OPTIONS(request(undefined, undefined, "OPTIONS"), {}) as Response;
    expect(response.status).toBe(204);
    expect(response.headers.get("Allow")).toBe("OPTIONS, POST");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
