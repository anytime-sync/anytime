import { describe, expect, it, vi } from "vitest";
import { signXRequest, verifyX, xFailure, type XCredentials } from "./x-connection";

const keys: XCredentials = {
  X_CONSUMER_KEY: "dpf43f3p2l4k3l03",
  X_CONSUMER_SECRET: "kd94hf93k423kf44",
  X_ACCESS_TOKEN: "nnch734d00sl2jdk",
  X_ACCESS_TOKEN_SECRET: "pfkkdhi9sl3r4s00",
};

describe("X connection", () => {
  it("matches the published OAuth 1.0 photo request signature", () => {
    const header = signXRequest("GET", "http://photos.example.net/photos?file=vacation.jpg&size=original", keys, "kllo9940pd9333jh", "1191242096");
    expect(header).toContain('oauth_signature="tR3%2BTy81lMeYAr%2FFid0kMTYa%2FWM%3D"');
    expect(header).not.toContain(keys.X_CONSUMER_SECRET);
    expect(header).not.toContain(keys.X_ACCESS_TOKEN_SECRET);
  });
  it("distinguishes credits, authorization and rate limits", () => {
    expect(xFailure(402).state).toBe("credits_required");
    expect(xFailure(401).state).toBe("reconnect_required");
    expect(xFailure(403).state).toBe("permissions_required");
    expect(xFailure(429).state).toBe("rate_limited");
  });
  it("verifies the intended account without publishing or following redirects", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "123", username: "AaronCheng69226" } })));
    expect((await verifyX(keys, fetcher)).state).toBe("connected");
    expect(fetcher).toHaveBeenCalledWith("https://api.x.com/2/users/me", expect.objectContaining({ redirect: "error", cache: "no-store" }));
  });
  it("rejects a different account and incomplete provider data", async () => {
    expect((await verifyX(keys, vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "123", username: "other" } }))))).state).toBe("account_mismatch");
    expect((await verifyX(keys, vi.fn().mockResolvedValue(new Response("{}")))).state).toBe("unavailable");
  });
  it("never returns raw provider errors or thrown credential data", async () => {
    const blocked = await verifyX(keys, vi.fn().mockResolvedValue(new Response("secret-provider-body", { status: 402 })));
    expect(blocked.state).toBe("credits_required");
    expect(JSON.stringify(blocked)).not.toContain("secret-provider-body");
    const failed = await verifyX(keys, vi.fn().mockRejectedValue(new Error(keys.X_ACCESS_TOKEN_SECRET)));
    expect(failed.state).toBe("unavailable");
    expect(JSON.stringify(failed)).not.toContain(keys.X_ACCESS_TOKEN_SECRET);
  });
});
