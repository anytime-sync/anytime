/**
 * Typed HTTP client wrapping the First Light public API.
 *
 * Reads `FIRSTLIGHT_API_KEY` and `FIRSTLIGHT_API_URL` from the environment
 * (set in the MCP server config by the host — Claude Desktop, OpenClaw, etc.).
 */
export declare class FirstlightClient {
    private base;
    private key;
    constructor();
    private req;
    listTasks(q?: Record<string, string | number | boolean | undefined>): Promise<{
        data: unknown[];
        pagination: unknown;
    }>;
    getTask(id: string): Promise<{
        data: unknown;
    }>;
    createTask(body: unknown): Promise<{
        data: unknown;
    }>;
    updateTask(id: string, body: unknown): Promise<{
        data: unknown;
    }>;
    completeTask(id: string): Promise<{
        data: unknown;
    }>;
    deleteTask(id: string): Promise<{
        deleted: boolean;
    }>;
    listEvents(q?: Record<string, string | number | boolean | undefined>): Promise<{
        data: unknown[];
    }>;
    getEvent(id: string): Promise<{
        data: unknown;
    }>;
    createEvent(body: unknown): Promise<{
        data: unknown;
    }>;
    updateEvent(id: string, body: unknown): Promise<{
        data: unknown;
    }>;
    deleteEvent(id: string): Promise<{
        deleted: boolean;
    }>;
    searchNotes(q: string, limit?: number): Promise<{
        q: string;
        count: number;
        results: unknown[];
    }>;
    getDaily(date?: string): Promise<unknown>;
    getDailyEdition(date?: string): Promise<{
        data: unknown;
    }>;
    listGoals(status?: string): Promise<{
        data: unknown[];
    }>;
    planDay(tasks: Array<{
        id: string;
        title: string;
        due_at?: string | null;
        priority: number;
        project?: string | null;
    }>): Promise<{
        suggestions: unknown[];
        notes: string;
    }>;
    planWeek(tasks: Array<{
        id: string;
        title: string;
        due_at?: string | null;
        priority: number;
        project?: string | null;
    }>): Promise<{
        suggestions: unknown[];
        notes: string;
    }>;
    prepMeeting(taskId: string, title: string, notes?: string, refresh?: boolean): Promise<{
        agenda: string[];
        questions: string[];
    }>;
    findTime(taskId: string, title: string, estimatedMinutes?: number): Promise<{
        slots: unknown[];
    }>;
    rescheduleOverdue(): Promise<{
        items: unknown[];
    }>;
    detectProcrastination(): Promise<{
        items: unknown[];
        summary: string;
    }>;
    morningCopilot(tz?: string, force?: boolean): Promise<unknown>;
    listTags(): Promise<{
        data: unknown[];
    }>;
    createTag(body: {
        name: string;
        color?: string;
    }): Promise<{
        data: unknown;
        created: boolean;
    }>;
    addTagsToTask(taskId: string, tagIds: string[]): Promise<{
        data: unknown[];
    }>;
    removeTagFromTask(taskId: string, tagId: string): Promise<{
        removed: boolean;
    }>;
    getTaskTags(taskId: string): Promise<{
        data: unknown[];
    }>;
}
