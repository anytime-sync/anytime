# First Light MCP server

Connect a compatible local stdio MCP client to [First Light](https://firstlight.to). API/MCP access requires Pro and an account token. AI usage limits apply.

## Build from source

Install Git and Node.js 20 or later:

```sh
git clone https://github.com/anytime-sync/anytime.git
cd anytime/firstlight-mcp
npm ci
npm run build
```

The server is not currently published as `firstlight-mcp` or `@firstlight/mcp-server` on npm. Use the built entry point rather than the previously documented `npx` command.

## Connect your account

Create a token at [API Tokens](https://firstlight.to/settings/api-tokens). Configure the client to run the built server, replacing the absolute path and token privately:

```json
{
  "mcpServers": {
    "firstlight": {
      "command": "node",
      "args": ["/absolute/path/to/anytime/firstlight-mcp/dist/index.js"],
      "env": { "FIRSTLIGHT_API_KEY": "YOUR_PRIVATE_TOKEN" }
    }
  }
}
```

On Windows, forward-slash paths such as `C:/path/to/anytime/firstlight-mcp/dist/index.js` are valid JSON. Configuration location and format depend on the client. Remote-only clients cannot use this local stdio entry directly. `FIRSTLIGHT_API_URL` optionally overrides the default `https://firstlight.to/api/v1`.

## Tools and behavior

The authoritative tool list is exported from `src/tools/index.ts` and returned by `tools/list`. This source revision exposes 21 tools for task and event reads/edits, note search, tags, goals and daily summaries. In-app planning tools are separate; other configured connections may expose different tools.

- `list_tasks` and `get_task` read tasks.
- `create_task`, `update_task`, `complete_task` and `delete_task` save changes.
- `list_events` reads calendar records; editing uses separate tools.
- `search_notes` searches saved notes.
- `daily_summary` reads structured daily records.
- `get_active_goals` reads active goals.
- `list_tags`, `create_tag`, `tag_task`, `untag_task` and `get_task_tags` manage labels.

Review suggestions before requesting edits, then read the record to verify the saved result. Tool availability is not proof of account authorization or a successful service call. Missing calendar records do not establish availability.

The previously documented `search_tasks`, `get_habits`, `weekly_review` and AI planning tool names are not exposed by this local source build. The connected AI client can reason about returned records and request edits. This server does not run a background scheduler or guarantee automatic morning briefings.

See [current plans](https://firstlight.to/pricing) and [setup guidance](https://firstlight.to/mcp).
