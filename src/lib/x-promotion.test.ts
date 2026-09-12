import { describe, expect, it, vi } from "vitest";
import { dispatchPromotion, sendPromotion, validatePromotion } from "./x-promotion";
import type { SupabaseClient } from "@supabase/supabase-js";
const keys = { X_CONSUMER_KEY: "test", X_CONSUMER_SECRET: "secret", X_ACCESS_TOKEN: "token", X_ACCESS_TOKEN_SECRET: "secret" };
describe("X publication safety", () => {
  it("allows correct brand links and counts CJK conservatively", () => {
    expect(validatePromotion("oqua", "A thoughtful weekend read https://www.oqua.com")).toBe(true);
    expect(validatePromotion("oqua", "中".repeat(128) + " https://oqua.com")).toBe(true);
    expect(validatePromotion("oqua", "中".repeat(129) + " https://oqua.com")).toBe(false);
    expect(validatePromotion("firstlight", "A new idea https://firstsight.to")).toBe(false);
    expect(validatePromotion("firstlight", "An idea https://firstlight.to.evil.test")).toBe(false);
    expect(validatePromotion("firstlight", "An idea https://key@firstlight.to")).toBe(false);
    expect(validatePromotion("firstlight", "An idea http://firstlight.to")).toBe(false);
  });
  it("sends one signed JSON POST and records the provider receipt", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "12345" } }), { status: 201 }));
    const result = await sendPromotion(keys, "Hello https://firstlight.to", fetcher);
    expect(result.status).toBe("posted"); expect(result.url).toBe("https://x.com/AaronCheng69226/status/12345");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("https://api.x.com/2/tweets");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", redirect: "error", body: JSON.stringify({ text: "Hello https://firstlight.to" }) });
  });
  it("does not retry ambiguous timeouts, malformed success or server errors", async () => {
    for (const response of [new Error("secret-provider-error"), new Response("{}", { status: 201 }), new Response("secret-provider-error", { status: 503 })]) {
      const fetcher = response instanceof Error ? vi.fn().mockRejectedValue(response) : vi.fn().mockResolvedValue(response);
      const result = await sendPromotion(keys, "text", fetcher);
      expect(result.status).toBe("uncertain"); expect(fetcher).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result)).not.toContain("secret-provider-error");
    }
  });
  it("pauses on exhausted credits, rejected credentials and rate limits", async () => {
    for (const code of [401, 402, 403, 429]) {
      expect(await sendPromotion(keys, "text", vi.fn().mockResolvedValue(new Response("private", { status: code })))).toMatchObject({ status: "failed", pause: true, error: `x_http_${code}` });
    }
  });
});

// Scripted query builder: checks the order and predicates before each response.
function database(responses: { table: string; result: unknown; check?: (calls: unknown[][]) => void }[]) {
  const remaining = [...responses];
  return { from(table: string) {
    const script = remaining.shift(); expect(script?.table).toBe(table);
    const calls: unknown[][] = [];
    const b: Record<string, unknown> = {};
    for (const method of ["update", "eq", "lt", "lte", "gte", "select", "order", "limit", "in"]) b[method] = (...args: unknown[]) => { calls.push([method, ...args]); return b; };
    b.maybeSingle = () => { script?.check?.(calls); return Promise.resolve(script?.result); };
    b.then = (resolve: (r: unknown) => void) => { script?.check?.(calls); resolve(script?.result); };
    return b;
  } } as unknown as SupabaseClient;
}
describe("dispatch locking", () => {
  it("does no X I/O if the account lease is already held or paused", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    const db = database([{ table: "x_promotion_control", result: { data: null }, check: calls => {
      expect(calls).toContainEqual(["eq", "enabled", true]);
      expect(calls.some(c => c[0] === "lt" && c[1] === "lease_until")).toBe(true);
    } }]);
    expect(await dispatchPromotion(db)).toEqual({ state: "paused_or_busy" });
    expect(fetcher).not.toHaveBeenCalled(); fetcher.mockRestore();
  });
  it("expires missed windows and never selects sending/uncertain rows", async () => {
    const db = database([
      { table: "x_promotion_control", result: { data: { id: 1 } } },
      { table: "x_promotion_queue", result: {}, check: c => { expect(c).toContainEqual(["eq", "status", "queued"]); expect(c.some(x => x[0] === "lt" && x[1] === "expires_at")).toBe(true); } },
      { table: "x_promotion_queue", result: { data: null }, check: c => { expect(c).toContainEqual(["eq", "status", "queued"]); expect(c).toContainEqual(["limit", 1]); } },
      { table: "x_promotion_control", result: {}, check: c => expect(c.some(x => x[0] === "eq" && x[1] === "lease_until")).toBe(true) },
    ]);
    expect(await dispatchPromotion(db)).toEqual({ state: "nothing_due" });
  });
});
