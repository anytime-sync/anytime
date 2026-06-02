/**
 * Tool registry + dispatcher. Each tool exposes:
 *   - name (snake_case verb)
 *   - description (assistant-facing — kept short)
 *   - inputSchema (JSON Schema for the LLM)
 *   - handler (async fn called with the typed args + client)
 */

import type { FirstlightClient } from "../client.js";

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  handler: (client: FirstlightClient, args: Record<string, unknown>) => Promise<unknown>;
}

// ---------- Tasks ----------------------------------------------------------

const list_tasks: Tool = {
  name: "list_tasks",
  description:
    "List the user's tasks with optional filters. Use this to find what's due, overdue, in a project, or matching a status. Returns up to 200 tasks.",
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
  handler: (c, a) => c.listTasks(a as Record<string, string | number>),
};

const get_task: Tool = {
  name: "get_task",
  description: "Fetch a single task by ID with full detail (notes, links, history fields).",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
    additionalProperties: false,
  },
  handler: (c, a) => c.getTask(a.id as string),
};

const create_task: Tool = {
  name: "create_task",
  description:
    "Create a new task. Prefer concise titles; put background in `notes`. Use ISO timestamps for `due_at` and `start_at`.",
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

const update_task: Tool = {
  name: "update_task",
  description:
    "Update fields on an existing task. Only the fields you pass are changed. Use this to reschedule, change priority, edit notes, or move to a project.",
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
    return c.updateTask(id as string, rest);
  },
};

const complete_task: Tool = {
  name: "complete_task",
  description: "Mark a task complete. Equivalent to update_task with status='done'.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
    additionalProperties: false,
  },
  handler: (c, a) => c.completeTask(a.id as string),
};

const delete_task: Tool = {
  name: "delete_task",
  description:
    "Hard-delete a task. Prefer update_task with status='archived' for soft-delete.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
    additionalProperties: false,
  },
  handler: (c, a) => c.deleteTask(a.id as string),
};

// ---------- Events ---------------------------------------------------------

const list_events: Tool = {
  name: "list_events",
  description:
    "List calendar events in a date range. Includes Google Calendar events synced into First Light.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "ISO datetime, inclusive." },
      to: { type: "string", description: "ISO datetime, inclusive." },
      limit: { type: "number", minimum: 1, maximum: 500, default: 100 },
    },
    additionalProperties: false,
  },
  handler: (c, a) => c.listEvents(a as Record<string, string | number>),
};

const get_event: Tool = {
  name: "get_event",
  description: "Fetch a single calendar event by ID.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
    additionalProperties: false,
  },
  handler: (c, a) => c.getEvent(a.id as string),
};

const create_event: Tool = {
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

const update_event: Tool = {
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
    return c.updateEvent(id as string, rest);
  },
};

const delete_event: Tool = {
  name: "delete_event",
  description: "Delete a calendar event.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
    additionalProperties: false,
  },
  handler: (c, a) => c.deleteEvent(a.id as string),
};

// ---------- Brain (notes + goals) -----------------------------------------

const search_notes: Tool = {
  name: "search_notes",
  description:
    "Semantic search over the user's notes (uses First Light's Voyage embeddings). Returns matching notes with title, snippet, score, and any linked task IDs. Use this when the user asks 'what did I write about X'.",
  inputSchema: {
    type: "object",
    properties: {
      q: { type: "string", description: "Natural-language query." },
      limit: { type: "number", minimum: 1, maximum: 100, default: 20 },
    },
    required: ["q"],
    additionalProperties: false,
  },
  handler: (c, a) => c.searchNotes(a.q as string, (a.limit as number) ?? 20),
};

const get_active_goals: Tool = {
  name: "get_active_goals",
  description:
    "List the user's active goals with progress, target dates, and linked task counts. Use this to ground your planning in what the user is working toward, not just today's tasks.",
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
  handler: (c, a) => c.listGoals((a.status as string) ?? "active"),
};

const link_task_to_note: Tool = {
  name: "link_task_to_note",
  description:
    "Link a task to a note. Use after creating a task that came out of a note, or vice versa.",
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
    return c.updateTask(a.task_id as string, {
      // The API route's PATCH handler will pick this up via ALLOWED list
      // once you extend it; for now this is a placeholder showing intent.
      // Recommended: add a dedicated POST /api/v1/tasks/{id}/links endpoint.
      linked_note_ids_add: [a.note_id],
    } as unknown as Record<string, unknown>);
  },
};

// ---------- Daily ---------------------------------------------------------

const daily_summary: Tool = {
  name: "daily_summary",
  description:
    "Return a structured snapshot of today (tasks, events, overdue count, completed today, active goals) in one call. Use this for 'what's on my plate today' style questions, then summarize in your own voice.",
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
  handler: (c, a) => c.getDaily(a.date as string | undefined),
};

const get_daily_edition: Tool = {
  name: "get_daily_edition",
  description:
    "Return First Light's editorial morning brief for a date (the 'First Light voice'). Use when the user wants the canned summary; otherwise prefer `daily_summary` and summarize in your own voice.",
  inputSchema: {
    type: "object",
    properties: { date: { type: "string" } },
    additionalProperties: false,
  },
  handler: (c, a) => c.getDailyEdition(a.date as string | undefined),
};

// ---------- Registry ------------------------------------------------------

export const tools: Tool[] = [
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
];

const byName = new Map(tools.map((t) => [t.name, t]));

export async function dispatch(
  client: FirstlightClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = byName.get(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.handler(client, args);


  // ─── AI Intelligence Tools ──────────────────────────────────────────

  server.tool(
    "plan_day",
    "AI-powered day planner: analyzes your tasks and calendar to suggest Eisenhower quadrant placement and priority for today. Pass up to 40 tasks.",
    {
      tasks: z.array(z.object({
        id: z.string().describe("Task ID"),
        title: z.string().describe("Task title"),
        due_at: z.string().nullable().optional().describe("Due date ISO 8601"),
        priority: z.number().int().min(0).max(5).describe("Priority 0-5"),
        project: z.string().nullable().optional().describe("Project name"),
      })).min(1).max(40).describe("Tasks to plan"),
    },
    async ({ tasks }) => {
      const result = await fl.planDay(tasks);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "plan_week",
    "AI-powered week planner: batch-prioritizes up to 30 tasks for the next 7 days with quadrant and priority suggestions.",
    {
      tasks: z.array(z.object({
        id: z.string(),
        title: z.string(),
        due_at: z.string().nullable().optional(),
        priority: z.number().int().min(0).max(5),
        project: z.string().nullable().optional(),
      })).min(1).max(30),
    },
    async ({ tasks }) => {
      const result = await fl.planWeek(tasks);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "prep_meeting",
    "Generate a meeting prep brief: agenda items and questions to ask. Caches results per task.",
    {
      task_id: z.string().describe("Task/event ID"),
      title: z.string().min(1).max(280).describe("Meeting title"),
      notes: z.string().optional().describe("Additional context or notes"),
      refresh: z.boolean().optional().describe("Force regenerate, ignoring cache"),
    },
    async ({ task_id, title, notes, refresh }) => {
      const result = await fl.prepMeeting(task_id, title, notes, refresh);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "find_time",
    "Suggest 3 best time slots in the next 7 days for a task, avoiding busy blocks.",
    {
      task_id: z.string().describe("Task ID"),
      title: z.string().min(1).max(280).describe("Task title"),
      estimated_minutes: z.number().int().optional().describe("Estimated duration in minutes (default 30)"),
    },
    async ({ task_id, title, estimated_minutes }) => {
      const result = await fl.findTime(task_id, title, estimated_minutes);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "reschedule_overdue",
    "Find all overdue tasks and suggest new realistic due dates spread across the next 7 days. No input needed.",
    {},
    async () => {
      const result = await fl.rescheduleOverdue();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "detect_procrastination",
    "Find stuck tasks (open 14+ days, untouched 7+ days) and recommend: drop, break-down, or schedule. No input needed.",
    {},
    async () => {
      const result = await fl.detectProcrastination();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "morning_copilot",
    "AI morning brief: proactive daily plan with task suggestions, calendar awareness, and energy-optimized scheduling. Cached per day.",
    {
      tz: z.string().optional().describe("Timezone e.g. 'Asia/Taipei' (default UTC)"),
      force: z.boolean().optional().describe("Force regenerate, ignoring today's cache"),
    },
    async ({ tz, force }) => {
      const result = await fl.morningCopilot(tz, force);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
