/**
 * Tool registry + dispatcher. Each tool exposes:
 *   - name (snake_case verb)
 *   - description (assistant-facing — kept short)
 *   - inputSchema (JSON Schema for the LLM)
 *   - handler (async fn called with the typed args + client)
 */
// ---------- Tasks ----------------------------------------------------------
const list_tasks = {
    name: "list_tasks",
    description: "List the user's tasks with optional filters. Use this to find what's due, overdue, in a project, or matching a status. Returns up to 200 tasks.",
    inputSchema: {
        type: "object",
        properties: {
            status: { type: "string", enum: ["open", "done", "archived"] },
            priority: { type: "string", enum: ["low", "med", "high"] },
            project: { type: "string", description: "Project ID to filter by." },
            from: { type: "string", description: "Earliest due_at, ISO date (YYYY-MM-DD)." },
            to: { type: "string", description: "Latest due_at, ISO date." },
            limit: { type: "number", minimum: 1, maximum: 200, default: 50 },
        },
        additionalProperties: false,
    },
    handler: (c, a) => c.listTasks(a),
};
const get_task = {
    name: "get_task",
    description: "Fetch a single task by ID with full detail (notes, links, history fields).",
    inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
    },
    handler: (c, a) => c.getTask(a.id),
};
const create_task = {
    name: "create_task",
    description: "Create a new task. Prefer concise titles; put background in `notes`. Use ISO timestamps for `due_at` and `start_at`.",
    inputSchema: {
        type: "object",
        properties: {
            title: { type: "string", maxLength: 500 },
            due_at: { type: "string", description: "ISO timestamp; null for unscheduled." },
            start_at: { type: "string" },
            priority: { type: "string", enum: ["low", "med", "high"] },
            notes: { type: "string" },
            project_id: { type: "string" },
        },
        required: ["title"],
        additionalProperties: false,
    },
    handler: (c, a) => c.createTask(a),
};
const update_task = {
    name: "update_task",
    description: "Update fields on an existing task. Only the fields you pass are changed. Use this to reschedule, change priority, edit notes, or move to a project.",
    inputSchema: {
        type: "object",
        properties: {
            id: { type: "string" },
            title: { type: "string" },
            due_at: { type: ["string", "null"] },
            start_at: { type: ["string", "null"] },
            priority: { type: ["string", "null"], enum: ["low", "med", "high", null] },
            notes: { type: ["string", "null"] },
            status: { type: "string", enum: ["open", "done", "archived"] },
            project_id: { type: ["string", "null"] },
        },
        required: ["id"],
        additionalProperties: false,
    },
    handler: (c, a) => {
        const { id, ...rest } = a;
        return c.updateTask(id, rest);
    },
};
const complete_task = {
    name: "complete_task",
    description: "Mark a task complete. Equivalent to update_task with status='done'.",
    inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
    },
    handler: (c, a) => c.completeTask(a.id),
};
const delete_task = {
    name: "delete_task",
    description: "Hard-delete a task. Prefer update_task with status='archived' for soft-delete.",
    inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
    },
    handler: (c, a) => c.deleteTask(a.id),
};
// ---------- Events ---------------------------------------------------------
const list_events = {
    name: "list_events",
    description: "List calendar events in a date range. Includes Google Calendar events synced into First Light.",
    inputSchema: {
        type: "object",
        properties: {
            from: { type: "string", description: "ISO datetime, inclusive." },
            to: { type: "string", description: "ISO datetime, inclusive." },
            limit: { type: "number", minimum: 1, maximum: 500, default: 100 },
        },
        additionalProperties: false,
    },
    handler: (c, a) => c.listEvents(a),
};
const get_event = {
    name: "get_event",
    description: "Fetch a single calendar event by ID.",
    inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
    },
    handler: (c, a) => c.getEvent(a.id),
};
const create_event = {
    name: "create_event",
    description: "Create a calendar event in First Light.",
    inputSchema: {
        type: "object",
        properties: {
            title: { type: "string" },
            start_at: { type: "string" },
            end_at: { type: "string" },
            description: { type: "string" },
            location: { type: "string" },
            all_day: { type: "boolean" },
            task_id: { type: "string", description: "Link to a task." },
        },
        required: ["title", "start_at", "end_at"],
        additionalProperties: false,
    },
    handler: (c, a) => c.createEvent(a),
};
const update_event = {
    name: "update_event",
    description: "Update fields on a calendar event.",
    inputSchema: {
        type: "object",
        properties: {
            id: { type: "string" },
            title: { type: "string" },
            start_at: { type: "string" },
            end_at: { type: "string" },
            description: { type: ["string", "null"] },
            location: { type: ["string", "null"] },
            all_day: { type: "boolean" },
            task_id: { type: ["string", "null"] },
        },
        required: ["id"],
        additionalProperties: false,
    },
    handler: (c, a) => {
        const { id, ...rest } = a;
        return c.updateEvent(id, rest);
    },
};
const delete_event = {
    name: "delete_event",
    description: "Delete a calendar event.",
    inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
    },
    handler: (c, a) => c.deleteEvent(a.id),
};
// ---------- Brain (notes + goals) -----------------------------------------
const search_notes = {
    name: "search_notes",
    description: "Semantic search over the user's notes (uses First Light's Voyage embeddings). Returns matching notes with title, snippet, score, and any linked task IDs. Use this when the user asks 'what did I write about X'.",
    inputSchema: {
        type: "object",
        properties: {
            q: { type: "string", description: "Natural-language query." },
            limit: { type: "number", minimum: 1, maximum: 100, default: 20 },
        },
        required: ["q"],
        additionalProperties: false,
    },
    handler: (c, a) => c.searchNotes(a.q, a.limit ?? 20),
};
const get_active_goals = {
    name: "get_active_goals",
    description: "List the user's active goals with progress, target dates, and linked task counts. Use this to ground your planning in what the user is working toward, not just today's tasks.",
    inputSchema: {
        type: "object",
        properties: {
            status: {
                type: "string",
                enum: ["active", "paused", "done", "archived"],
                default: "active",
            },
        },
        additionalProperties: false,
    },
    handler: (c, a) => c.listGoals(a.status ?? "active"),
};
const link_task_to_note = {
    name: "link_task_to_note",
    description: "Link a task to a note. Use after creating a task that came out of a note, or vice versa.",
    inputSchema: {
        type: "object",
        properties: {
            task_id: { type: "string" },
            note_id: { type: "string" },
        },
        required: ["task_id", "note_id"],
        additionalProperties: false,
    },
    handler: async (c, a) => {
        // Implemented as a PATCH on the task with linked_note_ids merged.
        // If your schema is different, adjust here.
        return c.updateTask(a.task_id, {
            // The API route's PATCH handler will pick this up via ALLOWED list
            // once you extend it; for now this is a placeholder showing intent.
            // Recommended: add a dedicated POST /api/v1/tasks/{id}/links endpoint.
            linked_note_ids_add: [a.note_id],
        });
    },
};
// ---------- Daily ---------------------------------------------------------
const daily_summary = {
    name: "daily_summary",
    description: "Return a structured snapshot of today (tasks, events, overdue count, completed today, active goals) in one call. Use this for 'what's on my plate today' style questions, then summarize in your own voice.",
    inputSchema: {
        type: "object",
        properties: {
            date: {
                type: "string",
                description: "YYYY-MM-DD; defaults to today.",
            },
        },
        additionalProperties: false,
    },
    handler: (c, a) => c.getDaily(a.date),
};
const get_daily_edition = {
    name: "get_daily_edition",
    description: "Return First Light's editorial morning brief for a date (the 'First Light voice'). Use when the user wants the canned summary; otherwise prefer `daily_summary` and summarize in your own voice.",
    inputSchema: {
        type: "object",
        properties: { date: { type: "string" } },
        additionalProperties: false,
    },
    handler: (c, a) => c.getDailyEdition(a.date),
};
// ---------- Tags -----------------------------------------------------------
const list_tags = {
    name: "list_tags",
    description: "List all tags (labels) for the user. Tags can be applied to tasks for categorization.",
    inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
    },
    handler: (c) => c.listTags(),
};
const create_tag = {
    name: "create_tag",
    description: "Create a new tag (label). If the tag already exists (case-insensitive), returns the existing one. Default color is indigo.",
    inputSchema: {
        type: "object",
        properties: {
            name: { type: "string", description: "Tag name, e.g. 'oqua', 'firstlight', 'work'." },
            color: { type: "string", description: "Hex color, e.g. '#6366f1'. Optional." },
        },
        required: ["name"],
        additionalProperties: false,
    },
    handler: (c, a) => c.createTag({ name: a.name, color: a.color }),
};
const tag_task = {
    name: "tag_task",
    description: "Add one or more tags to a task. Pass tag IDs (UUIDs). Use list_tags or create_tag first to get IDs.",
    inputSchema: {
        type: "object",
        properties: {
            task_id: { type: "string", description: "Task ID." },
            tag_ids: {
                type: "array",
                items: { type: "string" },
                description: "Array of tag IDs to add.",
            },
        },
        required: ["task_id", "tag_ids"],
        additionalProperties: false,
    },
    handler: (c, a) => c.addTagsToTask(a.task_id, a.tag_ids),
};
const untag_task = {
    name: "untag_task",
    description: "Remove a tag from a task.",
    inputSchema: {
        type: "object",
        properties: {
            task_id: { type: "string" },
            tag_id: { type: "string" },
        },
        required: ["task_id", "tag_id"],
        additionalProperties: false,
    },
    handler: (c, a) => c.removeTagFromTask(a.task_id, a.tag_id),
};
const get_task_tags = {
    name: "get_task_tags",
    description: "List all tags on a specific task.",
    inputSchema: {
        type: "object",
        properties: {
            task_id: { type: "string" },
        },
        required: ["task_id"],
        additionalProperties: false,
    },
    handler: (c, a) => c.getTaskTags(a.task_id),
};
// ---------- Registry ------------------------------------------------------
export const tools = [
    list_tasks,
    get_task,
    create_task,
    update_task,
    complete_task,
    delete_task,
    list_events,
    get_event,
    create_event,
    update_event,
    delete_event,
    search_notes,
    get_active_goals,
    link_task_to_note,
    daily_summary,
    get_daily_edition,
    list_tags,
    create_tag,
    tag_task,
    untag_task,
    get_task_tags,
];
const byName = new Map(tools.map((t) => [t.name, t]));
export async function dispatch(client, name, args) {
    const tool = byName.get(name);
    if (!tool)
        throw new Error(`Unknown tool: ${name}`);
    return tool.handler(client, args);
}
//# sourceMappingURL=index.js.map