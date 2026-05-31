# firstlight-mcp

MCP server for [First Light](https://firstlight.to). Lets Claude, Claude Code, OpenClaw, or any MCP-aware assistant read and edit your tasks, events, notes, goals, and daily editions.

## Install

```bash
npm install -g @firstlight/mcp-server
```

## Configure

Mint a personal access token at `firstlight.to/settings/api-tokens` (Pro tier). Then register in your MCP client.

### OpenClaw / Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "firstlight": {
      "command": "firstlight-mcp",
      "env": {
        "FIRSTLIGHT_API_KEY": "flp_live_…",
        "FIRSTLIGHT_API_URL": "https://firstlight.to/api/v1"
      }
    }
  }
}
```

`FIRSTLIGHT_API_URL` is optional; defaults to the production URL above.

## Tools (16)

| Tool | What it does |
|---|---|
| `list_tasks` | List tasks (status, priority, project, date range filters) |
| `get_task` | Single task detail |
| `create_task` | Create a task |
| `update_task` | Update title/due/priority/notes/status/project |
| `complete_task` | Mark done |
| `delete_task` | Hard-delete (prefer `update_task` with `archived`) |
| `list_events` | Calendar events in a range (includes GCal-synced events) |
| `get_event` | Single event |
| `create_event` | Create event |
| `update_event` | Update event |
| `delete_event` | Delete event |
| `search_notes` | Semantic search across notes (Voyage embeddings) |
| `get_active_goals` | Goals with progress & target dates |
| `link_task_to_note` | Connect a task to a note |
| `daily_summary` | Structured today payload — tasks + events + overdue + completions + goals |
| `get_daily_edition` | First Light's editorial morning brief for a date |

## Develop

```bash
git clone https://github.com/anytime-sync/firstlight-mcp
cd firstlight-mcp
npm install
npm run dev          # tsx watch on src/index.ts
```

Test locally without going through Claude:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | FIRSTLIGHT_API_KEY=flp_live_... npm run start
```

## License

MIT.

