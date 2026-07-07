# First Light MCP Server

Model Context Protocol server for [First Light](https://firstlight.to) — the AI-native task manager.

## Tools (28)

### Task Management
| Tool | Description |
|------|-------------|
| `list_tasks` | List tasks with filters (status, priority, project, date range) |
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
| `search_notes` | Semantic search across notes (Voyage embeddings) |
| `get_active_goals` | List active goals with progress and linked task counts |
| `link_task_to_note` | Link a task to a note |
| `daily_summary` | Structured snapshot of a day (tasks, events, overdue, goals) |
| `get_daily_edition` | First Light's editorial morning brief for a date |

### Tags
| Tool | Description |
|------|-------------|
| `list_tags` | List all tags (labels) |
| `create_tag` | Create a tag (returns existing if name matches) |
| `tag_task` | Add one or more tags to a task |
| `untag_task` | Remove a tag from a task |
| `get_task_tags` | List all tags on a task |

### AI Intelligence
| Tool | Description |
|------|-------------|
| `plan_day` | AI day planner — quadrant + priority suggestions grounded in today's tasks and calendar |
| `plan_week` | AI week planner — batch-prioritize up to 30 tasks across 7 days |
| `prep_meeting` | Generate a meeting agenda + questions to ask. Cached per task. |
| `find_time` | Suggest the best time slots in the next 7 days for a task |
| `reschedule_overdue` | Given overdue tasks, suggest realistic new due dates (or defer/drop) |
| `detect_procrastination` | Find stuck tasks and recommend: drop, break down, or schedule |
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
