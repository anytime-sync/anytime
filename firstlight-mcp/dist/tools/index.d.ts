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
export declare const tools: Tool[];
export declare function dispatch(client: FirstlightClient, name: string, args: Record<string, unknown>): Promise<unknown>;
