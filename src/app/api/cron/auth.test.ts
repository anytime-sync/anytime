import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getResend: vi.fn(),
  syncCalendar: vi.fn(),
  drainDeletions: vi.fn(),
  pushTasks: vi.fn(),
  getToken: vi.fn(),
  syncEmbedding: vi.fn(),
  dispatchPromotion: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/resend", () => ({ getResend: mocks.getResend, getFromAddress: vi.fn() }));
vi.mock("@/lib/calendar-sync", () => ({ syncUserCalendar: mocks.syncCalendar }));
vi.mock("@/lib/calendar-write", () => ({ drainCalendarDeletions: mocks.drainDeletions, pushPendingTasksForUser: mocks.pushTasks }));
vi.mock("@/lib/calendar-token", () => ({ getValidAccessToken: mocks.getToken }));
vi.mock("@/lib/embeddings", () => ({
  syncEmbedding: mocks.syncEmbedding,
  snippetForComment: vi.fn(),
  snippetForNote: vi.fn(),
  snippetForTask: vi.fn(),
}));
vi.mock("@/lib/x-promotion", () => ({ dispatchPromotion: mocks.dispatchPromotion }));
vi.mock("@/lib/feature-flags", () => ({ getEffectiveFeature: vi.fn() }));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));

import * as calendar from "./calendar-sync/route";
import * as digest from "./daily-digest/route";
import * as editions from "./daily-editions/route";
import * as embeddings from "./embeddings-sync/route";
import * as promotion from "./x-promotion/route";
import * as reminders from "../reminders/dispatch/route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe.each([
  ["calendar-sync GET", calendar.GET], ["calendar-sync POST", calendar.POST],
  ["daily-digest GET", digest.GET], ["daily-digest POST", digest.POST],
  ["daily-editions GET", editions.GET], ["daily-editions POST", editions.POST],
  ["embeddings-sync GET", embeddings.GET], ["embeddings-sync POST", embeddings.POST],
  ["x-promotion GET", promotion.GET],
  ["reminders GET", reminders.GET], ["reminders POST", reminders.POST],
] as const)("%s authentication boundary", (name, handler) => {
  it.each([
    [undefined, undefined],
    [undefined, "Bearer undefined"],
    ["", "Bearer "],
    ["   ", "Bearer    "],
    ["test-secret", undefined],
    ["test-secret", "Bearer test-secreu"],
  ])("rejects secret %j and header %j before privileged work", async (secret, header) => {
    vi.stubEnv("CRON_SECRET", secret);
    const response = await handler(new Request("https://firstlight.test/api/cron/test", {
      method: name.endsWith("POST") ? "POST" : "GET",
      headers: { "x-vercel-cron": "1", ...(header ? { authorization: header } : {}) },
    }));
    expect(response.status).toBe(401);
    for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled();
  });
});
