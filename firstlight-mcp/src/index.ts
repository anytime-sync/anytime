#!/usr/bin/env node
/**
 * firstlight-mcp — MCP server exposing First Light to Claude / OpenClaw / any
 * MCP-aware assistant via stdio transport.
 *
 * Tools (16):
 *   Tasks:   list_tasks, get_task, create_task, update_task,
 *            complete_task, delete_task
 *   Events:  list_events, get_event, create_event, update_event,
 *            delete_event
 *   Brain:   search_notes, link_task_to_note, get_active_goals
 *   Daily:   daily_summary (raw structured), get_daily_edition (editorial)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { FirstlightClient } from "./client.js";
import { tools, dispatch } from "./tools/index.js";

const client = new FirstlightClient();
const server = new Server(
  {
    name: "firstlight-mcp",
    version: "0.1.0",
  },
  {
    capabilities: { tools: {} },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    const result = await dispatch(client, name, args ?? {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${message}` }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
// stderr-only logging so it doesn't corrupt stdio JSON-RPC.
process.stderr.write("firstlight-mcp ready (16 tools)\n");

