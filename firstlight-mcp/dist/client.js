/**
 * Typed HTTP client wrapping the First Light public API.
 *
 * Reads `FIRSTLIGHT_API_KEY` and `FIRSTLIGHT_API_URL` from the environment
 * (set in the MCP server config by the host — Claude Desktop, OpenClaw, etc.).
 */
const DEFAULT_BASE = "https://firstlight.to/api/v1";
export class FirstlightClient {
    base;
    key;
    constructor() {
        this.base = process.env.FIRSTLIGHT_API_URL ?? DEFAULT_BASE;
        const key = process.env.FIRSTLIGHT_API_KEY;
        if (!key) {
            throw new Error("FIRSTLIGHT_API_KEY is required. Mint one at firstlight.to/settings/api-tokens.");
        }
        this.key = key;
    }
    async req(method, path, init) {
        const url = new URL(this.base + path);
        if (init?.query) {
            for (const [k, v] of Object.entries(init.query)) {
                if (v === undefined || v === null)
                    continue;
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
        if (res.status === 204)
            return undefined;
        return (await res.json());
    }
    // ---------- Tasks --------------------------------------------------------
    listTasks(q) {
        return this.req("GET", "/tasks", {
            query: q,
        });
    }
    getTask(id) {
        return this.req("GET", `/tasks/${id}`);
    }
    createTask(body) {
        return this.req("POST", "/tasks", { body });
    }
    updateTask(id, body) {
        return this.req("PATCH", `/tasks/${id}`, { body });
    }
    completeTask(id) {
        return this.req("POST", `/tasks/${id}/complete`);
    }
    deleteTask(id) {
        return this.req("DELETE", `/tasks/${id}`);
    }
    // ---------- Events -------------------------------------------------------
    listEvents(q) {
        return this.req("GET", "/events", { query: q });
    }
    getEvent(id) {
        return this.req("GET", `/events/${id}`);
    }
    createEvent(body) {
        return this.req("POST", "/events", { body });
    }
    updateEvent(id, body) {
        return this.req("PATCH", `/events/${id}`, { body });
    }
    deleteEvent(id) {
        return this.req("DELETE", `/events/${id}`);
    }
    // ---------- Notes / Daily / Goals ---------------------------------------
    searchNotes(q, limit = 20) {
        return this.req("GET", "/notes/search", { query: { q, limit } });
    }
    getDaily(date) {
        return this.req("GET", "/daily", { query: { date } });
    }
    getDailyEdition(date) {
        return this.req("GET", "/daily-edition", { query: { date } });
    }
    listGoals(status = "active") {
        return this.req("GET", "/goals", { query: { status } });
    }
    // ---------- AI Intelligence -----------------------------------------------
    planDay(tasks) {
        return this.req("POST", "/ai/plan-day", { body: { tasks } });
    }
    planWeek(tasks) {
        return this.req("POST", "/ai/plan-week", { body: { tasks } });
    }
    prepMeeting(taskId, title, notes, refresh) {
        return this.req("POST", "/ai/prep-meeting", { body: { task_id: taskId, title, notes, refresh } });
    }
    findTime(taskId, title, estimatedMinutes) {
        return this.req("POST", "/ai/find-time", { body: { task_id: taskId, title, estimated_minutes: estimatedMinutes } });
    }
    rescheduleOverdue() {
        return this.req("POST", "/ai/reschedule-overdue", { body: {} });
    }
    detectProcrastination() {
        return this.req("POST", "/ai/detect-procrastination", { body: {} });
    }
    morningCopilot(tz, force) {
        return this.req("POST", "/ai/morning-copilot", { body: { tz, force } });
    }
    // ---------- Tags ---------------------------------------------------------
    listTags() {
        return this.req("GET", "/tags");
    }
    createTag(body) {
        return this.req("POST", "/tags", { body });
    }
    addTagsToTask(taskId, tagIds) {
        return this.req("POST", `/tasks/${taskId}/tags`, { body: { tag_ids: tagIds } });
    }
    removeTagFromTask(taskId, tagId) {
        return this.req("DELETE", `/tasks/${taskId}/tags/${tagId}`);
    }
    getTaskTags(taskId) {
        return this.req("GET", `/tasks/${taskId}/tags`);
    }
}
//# sourceMappingURL=client.js.map