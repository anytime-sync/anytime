---
title: "How to Manage Your Tasks with Claude Using MCP"
description: "A step-by-step guide to connecting Claude (or any AI assistant) to your task manager using the Model Context Protocol. Stop copy-pasting your to-do list into chat."
date: "2026-06-06"
author: "Aaron Cheng"
tags: ["MCP", "Claude", "AI", "tutorial", "productivity"]
lang: "en"
image: "/og.png"
---

Every morning I open Claude and paste my task list into it. "Here's what I have today — help me prioritize." Claude gives me a great plan. Then I manually move tasks around in my planner to match.

This is stupid.

I'm using an AI that can reason about my entire week, but I'm the bottleneck — copying data between two apps like it's 2019. The AI can't see my calendar. It can't check what's overdue. It can't mark anything done.

MCP fixes this.

## What is MCP?

MCP (Model Context Protocol) is an open standard that lets AI assistants connect to external tools. Instead of you telling Claude what's on your calendar, Claude checks your calendar itself. Instead of you pasting your task list, Claude reads it directly.

Think of it as USB for AI. You plug in a "server" (your task manager, your calendar, your codebase), and the AI can read from it and write to it.

Anthropic released MCP in late 2024. It's now supported by Claude Desktop, Cursor, Windsurf, and a growing number of AI clients.

## The problem with current task managers

Todoist, Things, TickTick — they're all great apps. But none of them speak MCP natively. If you want AI to manage your tasks, you have three options:

1. **Copy-paste** — Open your task manager, screenshot or type out your tasks, paste into Claude, get a response, manually update your tasks. This is what most people do. It works. It's also tedious and error-prone.

2. **Zapier/Make integrations** — Set up automation flows between your AI and your task manager. Complex to configure, brittle, and limited to simple actions (usually just "create task").

3. **MCP** — Your AI reads and writes your tasks directly. No middle layer. No copy-pasting. You just talk.

## Setting up MCP with First Light

[First Light](https://firstlight.to) is (as far as I know) the only task manager with a native MCP server. Here's how to set it up:

### Step 1: Get your API token

Sign up at [firstlight.to](https://firstlight.to) and go to **Settings → API Tokens**. Create a new token. Copy it — you'll need it in a moment.

### Step 2: Configure Claude Desktop

Open your Claude Desktop config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add the First Light MCP server:

```json
{
  "mcpServers": {
    "firstlight": {
      "command": "npx",
      "args": ["firstlight-mcp"],
      "env": {
        "FIRSTLIGHT_API_KEY": "your-token-here"
      }
    }
  }
}
```

Restart Claude Desktop. That's it.

### Step 3: Talk to Claude

Now Claude can see your tasks. Try these:

- *"What's on my plate today?"*
- *"Add a task: review the Q3 deck by Friday, high priority"*
- *"Move all overdue tasks to tomorrow and reprioritize"*
- *"What did I accomplish this week?"*
- *"Plan my day around the 2pm meeting"*

Claude reads your tasks, understands your calendar, and makes changes directly in First Light. No copy-pasting. No tab switching.

## What the MCP server can do

The First Light MCP server exposes these tools:

| Tool | What it does |
|------|-------------|
| `list_tasks` | Get tasks by date, status, or priority |
| `create_task` | Add a new task with title, date, priority, notes |
| `update_task` | Edit any field on an existing task |
| `complete_task` | Mark a task as done |
| `delete_task` | Remove a task |
| `plan_day` | AI-reorganize today's schedule |
| `search_tasks` | Semantic search across all your tasks |
| `get_habits` | Check habit streaks and progress |
| `weekly_review` | Generate a summary of your week |

## A real morning workflow

Here's what my actual morning looks like now:

1. Open Claude Desktop
2. Say: *"Good morning. What does today look like?"*
3. Claude checks my First Light tasks, reads my Google Calendar events, and gives me a briefing
4. I say: *"Move the design review to Thursday and add 30 minutes of deep work before the 11am call"*
5. Claude reschedules the task and creates a time block — all inside First Light
6. I open First Light and see my day, already planned

Total time: about 90 seconds. No manual sorting. No dragging cards around. No forgetting the thing I meant to do before lunch.

## Works with more than Claude

MCP is an open protocol. First Light works with any MCP-compatible client:

- **Claude Desktop** — the most polished experience
- **Cursor / Windsurf** — if you code and plan in the same workspace
- **OpenClaw** — for the self-hosted crowd
- **Any custom client** — MCP is a simple JSON-RPC protocol

## The bigger picture

Today, most people use AI as a conversation partner. You talk to it, it talks back, and then you go do the thing manually.

MCP changes this. Your AI doesn't just advise — it acts. It reads your real data. It makes real changes. The boundary between "planning with AI" and "doing with AI" disappears.

Task management is one of the first places this matters, because the gap between knowing what to do and actually reorganizing your system is where most productivity breaks down.

## Try it

First Light is free to start. The MCP server is open source. Setup takes about two minutes.

→ [firstlight.to](https://firstlight.to)
→ [MCP setup guide](https://firstlight.to/mcp)
→ [GitHub](https://github.com/anytime-sync/anytime)

If you're already using Claude and a task manager, this is the bridge between them.