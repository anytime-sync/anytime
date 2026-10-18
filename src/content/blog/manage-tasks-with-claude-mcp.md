---
retired: true
title: "How to Manage Your Tasks with Claude Using MCP"
description: "Set up First Light Pro with a compatible MCP client and distinguish planning suggestions from saved task edits."
date: "2026-06-06"
author: "Aaron Cheng"
tags: ["MCP", "Claude", "AI", "tutorial", "productivity"]
lang: "en"
image: "/og.png"
updated: "2026-10-18"
---

## Connect your planner deliberately

MCP lets a compatible AI client use tools exposed by another service. First Light's API/MCP access is a Pro feature. It can let an authorized assistant read and edit your tasks, but it does not give every AI app access automatically.

## Set up a local MCP client

Use a client that supports local stdio MCP servers. Install Git and Node.js 20 or later. The server is available from the public source repository; the previously documented `npx firstlight-mcp` command does not resolve to a published npm package.

Build the server:

```sh
git clone https://github.com/anytime-sync/anytime.git
cd anytime/firstlight-mcp
npm ci
npm run build
```

On Pro, open [API Tokens](/settings/api-tokens), create a token and copy it securely. Configure your client with the following entry. Replace the path with the absolute location of your built server and enter the token privately. On Windows, forward slashes such as `C:/path/to/anytime/firstlight-mcp/dist/index.js` work in JSON paths.

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

The location and format of client settings vary. Follow your client's current MCP instructions, reload the connection, and first ask it to list your tasks. Clients that support only remote servers need a different connection method; this configuration is not universal. Never paste a live token into a public issue or chat.

## Tools and their boundaries

| Tool | Behavior |
| --- | --- |
| list_tasks / get_task | Read tasks |
| create_task / update_task | Save task changes |
| complete_task / delete_task | Complete or delete a task |
| list_events | Read recorded calendar events |
| search_notes | Search saved notes |
| daily_summary | Read structured daily records |
| get_active_goals | Read active goals |
| list_tags / create_tag | Read or create task labels |

The source-built server exposes 21 tools at this revision. The earlier guide listed search_tasks, get_habits and weekly_review; those names are not exposed. In-app AI planning features are separate from this local server's tool list. Other configured connections may expose additional tools; inspect your client's list rather than assuming they are present.

## A workflow to try

Ask for today's tasks, then ask for priority suggestions. Review the result before requesting a specific update. Finally, ask the assistant to read the task again and verify the saved state. Planning output alone is not proof of a changed deadline or calendar booking.

First Light is not the only product with MCP support: [Todoist](https://developer.todoist.com/api/v1/) and [Notion](https://developers.notion.com/guides/mcp/overview) also provide official servers. Choose based on the records and workflow you want your assistant to use. See the [First Light setup page](/mcp) and [server source](https://github.com/anytime-sync/anytime/tree/main/firstlight-mcp).

## Using First Light

The core task planner is free. **Brief me** is optional and uses recorded tasks and calendar context; it does not change your tasks. Plus adds Google Calendar editing and reflection. Pro adds planning suggestions, voice/image capture, weekly reviews and API/MCP access. AI features have daily usage limits. Saving, syncing and AI require internet access. See [current plans](/pricing) before choosing an upgrade.
