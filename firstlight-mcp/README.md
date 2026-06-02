# First Light MCP Server

Model Context Protocol server for [First Light](https://firstlight.to) — the AI-native task manager.

## Tools (23 total)

### Task Management
| Tool | Description |
|------|-------------|
| `list_tasks` | List tasks with filters (status, project, date range) |
| `get_task` | Get a single task by ID |
| `create_task` | Create a new task |
| `update_task` | Update task properties |
| `complete_task` | Mark a task as complete |
| `delete_task` | Delete a task |

### Calendar & Events
| Tool | Description |
|------|-------------|
| `list_events` | List calendar events |
| `get_event` | Get a single event |
| `create_event` | Create a calendar event |
| `update_event` | Update an event |
| `delete_event` | Delete an event |

### Notes, Daily & Goals
| Tool | Description |
|------|-------------|
| `search_notes` | Full-text search across notes |
| `get_daily` | Get daily summary for a date |
| `get_daily_edition` | Get AI-generated daily edition |
| `list_goals` | List goals by status |
| `get_inbox` | Get inbox items |

### 🧠 AI Intelligence (NEW)
| Tool | Description |
|------|-------------|
| `plan_day` | AI day planner — quadrant + priority suggestions based on today's tasks and calendar |
| `plan_week` | AI week planner — batch prioritize up to 30 tasks across 7 days |
| `prep_meeting` | Generate meeting agenda + questions to ask. Cached per task. |
| `find_time` | Suggest 3 best time slots in the next 7 days for a task |
| `reschedule_overdue` | Find all overdue tasks, suggest realistic new due dates |
| `detect_procrastination` | Find stuck tasks (14+ days) and recommend: drop, break-down, or schedule |
| `morning_copilot` | Proactive morning brief with task suggestions and calendar awareness |

## What Makes This Different

Other task apps have CRUD APIs. First Light's MCP server **thinks**.

An AI agent connected to First Light can:
- Plan your day/week with intelligent prioritization
- Prep for meetings automatically before they start
- Find time slots that work around your busy schedule
- Clean up overdue and stuck tasks proactively
- Generate a morning brief without you asking

This is the moat. No other task management MCP server has AI planning built in.

## Setup

```bash
npm install
```

### Environment
```
FIRSTLIGHT_API_KEY=your-api-key
FIRSTLIGHT_API_URL=https://firstlight.to/api/v1  # optional, this is the default
```

### Claude Desktop
```json
{
  "mcpServers": {
    "firstlight": {
      "command": "npx",
      "args": ["-y", "firstlight-mcp"],
      "env": {
        "FIRSTLIGHT_API_KEY": "your-key-here"
      }
    }
  }
}
```

### OpenClaw
Add to your OpenClaw MCP config:
```json
{
  "firstlight": {
    "command": "npx",
    "args": ["-y", "firstlight-mcp"],
    "env": {
      "FIRSTLIGHT_API_KEY": "your-key-here"
    }
  }
}
```

## API Key

Generate your API key at [firstlight.to/settings/api-tokens](https://firstlight.to/settings/api-tokens).
