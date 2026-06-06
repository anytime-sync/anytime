/**
 * Typed HTTP client wrapping the First Light public API.
 *
 * Reads `FIRSTLIGHT_API_KEY` and `FIRSTLIGHT_API_URL` from the environment
 * (set in the MCP server config by the host — Claude Desktop, OpenClaw, etc.).
 */

const DEFAULT_BASE = "https://firstlight.to/api/v1";

export class FirstlightClient {
  private base: string;
  private key: string;

  constructor() {
    this.base = process.env.FIRSTLIGHT_API_URL ?? DEFAULT_BASE;
    const key = process.env.FIRSTLIGHT_API_KEY;
    if (!key) {
      throw new Error(
        "FIRSTLIGHT_API_KEY is required. Mint one at firstlight.to/settings/api-tokens.",
      );
    }
    this.key = key;
  }

  private async req<T>(
    method: string,
    path: string,
    init?: { query?: Record<string, string | number | boolean | undefined>; body?: unknown },
  ): Promise<T> {
    const url = new URL(this.base + path);
    if (init?.query) {
      for (const [k, v] of Object.entries(init.query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Content-Type": "application/json",
        "User-Agent": "firstlight-mcp/0.1.0",
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`First Light API ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // ---------- Tasks --------------------------------------------------------
  listTasks(q?: Record<string, string | number | boolean | undefined>) {
    return this.req<{ data: unknown[]; pagination: unknown }>("GET", "/tasks", {
      query: q,
    });
  }
  getTask(id: string) {
    return this.req<{ data: unknown }>("GET", `/tasks/${id}`);
  }
  createTask(body: unknown) {
    return this.req<{ data: unknown }>("POST", "/tasks", { body });
  }
  updateTask(id: string, body: unknown) {
    return this.req<{ data: unknown }>("PATCH", `/tasks/${id}`, { body });
  }
  completeTask(id: string) {
    return this.req<{ data: unknown }>("POST", `/tasks/${id}/complete`);
  }
  deleteTask(id: string) {
    return this.req<{ deleted: boolean }>("DELETE", `/tasks/${id}`);
  }

  // ---------- Events -------------------------------------------------------
  listEvents(q?: Record<string, string | number | boolean | undefined>) {
    return this.req<{ data: unknown[] }>("GET", "/events", { query: q });
  }
  getEvent(id: string) {
    return this.req<{ data: unknown }>("GET", `/events/${id}`);
  }
  createEvent(body: unknown) {
    return this.req<{ data: unknown }>("POST", "/events", { body });
  }
  updateEvent(id: string, body: unknown) {
    return this.req<{ data: unknown }>("PATCH", `/events/${id}`, { body });
  }
  deleteEvent(id: string) {
    return this.req<{ deleted: boolean }>("DELETE", `/events/${id}`);
  }

  // ---------- Notes / Daily / Goals ---------------------------------------
  searchNotes(q: string, limit = 20) {
    return this.req<{ q: string; count: number; results: unknown[] }>(
      "GET",
      "/notes/search",
      { query: { q, limit } },
    );
  }
  getDaily(date?: string) {
    return this.req<unknown>("GET", "/daily", { query: { date } });
  }
  getDailyEdition(date?: string) {
    return this.req<{ data: unknown }>("GET", "/daily-edition", { query: { date } });
  }
  listGoals(status: string = "active") {
    return this.req<{ data: unknown[] }>("GET", "/goals", { query: { status } });
  }

  // ---------- AI Intelligence -----------------------------------------------
  planDay(tasks: Array<{ id: string; title: string; due_at?: string | null; priority: number; project?: string | null }>) {
    return this.req<{ suggestions: unknown[]; notes: string }>("POST", "/ai/plan-day", { body: { tasks } });
  }
  planWeek(tasks: Array<{ id: string; title: string; due_at?: string | null; priority: number; project?: string | null }>) {
    return this.req<{ suggestions: unknown[]; notes: string }>("POST", "/ai/plan-week", { body: { tasks } });
  }
  prepMeeting(taskId: string, title: string, notes?: string, refresh?: boolean) {
    return this.req<{ agenda: string[]; questions: string[] }>("POST", "/ai/prep-meeting", { body: { task_id: taskId, title, notes, refresh } });
  }
  findTime(taskId: string, title: string, estimatedMinutes?: number) {
    return this.req<{ slots: unknown[] }>("POST", "/ai/find-time", { body: { task_id: taskId, title, estimated_minutes: estimatedMinutes } });
  }
  rescheduleOverdue() {
    return this.req<{ items: unknown[] }>("POST", "/ai/reschedule-overdue", { body: {} });
  }
  detectProcrastination() {
    return this.req<{ items: unknown[]; summary: string }>("POST", "/ai/detect-procrastination", { body: {} });
  }
  morningCopilot(tz?: string, force?: boolean) {
    return this.req<unknown>("POST", "/ai/morning-copilot", { body: { tz, force } });
  }

  // ---------- Tags ---------------------------------------------------------
  listTags() {
    return this.req<{ data: unknown[] }>("GET", "/tags");
  }
  createTag(body: { name: string; color?: string }) {
    return this.req<{ data: unknown; created: boolean }>("POST", "/tags", { body });
  }
  addTagsToTask(taskId: string, tagIds: string[]) {
    return this.req<{ data: unknown[] }>("POST", `/tasks/${taskId}/tags`, { body: { tag_ids: tagIds } });
  }
  removeTagFromTask(taskId: string, tagId: string) {
    return this.req<{ removed: boolean }>("DELETE", `/tasks/${taskId}/tags/${tagId}`);
  }
  getTaskTags(taskId: string) {
    return this.req<{ data: unknown[] }>("GET", `/tasks/${taskId}/tags`);
  }
}
