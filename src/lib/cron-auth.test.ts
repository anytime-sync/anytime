import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedCron } from "./cron-auth";

afterEach(() => vi.unstubAllEnvs());

describe("cron authorization", () => {
  it.each([undefined, "", " ", "\t\n"])(
    "fails closed for an unset or blank secret (%j)",
    (secret) => {
      vi.stubEnv("CRON_SECRET", secret);
      expect(isAuthorizedCron(null)).toBe(false);
      expect(isAuthorizedCron(`Bearer ${secret ?? "undefined"}`)).toBe(false);
    },
  );

  it.each([
    null,
    "",
    "Bearer",
    "Bearer wrong",
    "Bearer test-secreu",
    "Bearer test-secrét",
    "Basic test-secret",
    "bearer test-secret",
    "Bearer  test-secret",
    "Bearer test-secret ",
  ])("rejects a missing or incorrect authorization header (%j)", (header) => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    expect(isAuthorizedCron(header)).toBe(false);
  });

  it("accepts only the exact configured nonblank secret", () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    expect(isAuthorizedCron("Bearer test-secret")).toBe(true);
  });

  it("does not trim or otherwise change a nonblank configured secret", () => {
    vi.stubEnv("CRON_SECRET", " test-secret");
    expect(isAuthorizedCron("Bearer  test-secret")).toBe(true);
    expect(isAuthorizedCron("Bearer test-secret")).toBe(false);
  });
});
