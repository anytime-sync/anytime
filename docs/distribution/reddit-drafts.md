# Reddit Distribution Drafts — First Light
Generated 2026-06-06. Edit to taste before posting.

---

## 1. r/mcp — Technical audience, show the integration

**Title:** I built a task manager with a native MCP server — here's what it looks like in Claude Desktop

**Body:**

Hey r/mcp — I've been building a task management app called First Light, and I wanted to share the MCP integration since I think it's one of the more practical examples of MCP in daily use.

**What it does:** First Light exposes an MCP server (`npx firstlight-mcp`) that gives Claude (or any MCP client) full read/write access to your tasks. Not just "create task" — it can list, search, complete, reschedule, plan your day, and generate weekly reviews.

**Tools exposed:**
- `list_tasks` — by date, status, or priority
- `create_task` / `update_task` / `complete_task` / `delete_task`
- `plan_day` — AI-reorganizes your schedule
- `search_tasks` — semantic search across everything
- `get_habits` — streak tracking
- `weekly_review` — summarize what got done

**My actual workflow:** Every morning I open Claude and say "What does today look like?" It reads my tasks and calendar, gives me a briefing, and I can tell it to reschedule things or reprioritize. Changes happen directly in the app — no copy-pasting, no middle layer.

**Setup:**
```json
{
  "mcpServers": {
    "firstlight": {
      "command": "npx",
      "args": ["firstlight-mcp"],
      "env": {
        "FIRSTLIGHT_API_KEY": "your-token"
      }
    }
  }
}
```

The MCP server is open source: https://github.com/anytime-sync/anytime/tree/main/mcp-server

The app itself: https://firstlight.to/mcp

Happy to answer questions about the implementation. Built with the official MCP SDK, uses streamable HTTP transport.

---

## 2. r/ClaudeAI — User-focused, workflow angle

**Title:** I stopped copy-pasting my to-do list into Claude. Here's what I do instead.

**Body:**

Like a lot of people here, I was doing the daily ritual: open my task manager, screenshot or type out my tasks, paste into Claude, ask it to help me prioritize, then manually update my task manager with the result.

It worked fine. But it was also kind of absurd — I'm using an AI that can reason about my entire week, and I'm the slow bottleneck copying data between tabs.

So I built a task manager with native MCP support. Now my morning looks like this:

1. Open Claude Desktop
2. "Good morning. What does today look like?"
3. Claude reads my tasks and calendar directly, gives me a briefing
4. "Move the design review to Thursday, add deep work before the 11am call"
5. Done. Changes are already in my planner.

The key difference: Claude isn't just advising me — it's reading and writing my actual task data. No screenshots, no Zapier, no middleware.

The app is called First Light (https://firstlight.to). Free tier is generous, MCP server is open source. The setup is just adding a few lines to your claude_desktop_config.json:

```json
{
  "mcpServers": {
    "firstlight": {
      "command": "npx",
      "args": ["firstlight-mcp"],
      "env": { "FIRSTLIGHT_API_KEY": "your-token" }
    }
  }
}
```

More detailed walkthrough on the blog: https://firstlight.to/blog/manage-tasks-with-claude-mcp

If you're using Claude for daily planning, this might save you a surprising amount of friction. Happy to answer questions.

---

## 3. r/productivity — Non-technical, outcome-focused

**Title:** My AI plans my entire day in 90 seconds. Here's the setup.

**Body:**

I run a consumer brands division — about 60 people, multiple product lines, quarterly reviews. My days aren't short on tasks. They're short on clarity.

I tried every productivity system: Todoist, Things, Notion, TickTick, bullet journals. They all did the same thing — gave me a list and told me to figure it out. Lists don't plan your day. They just remind you how much you haven't done.

Six months ago I started building my own task manager. The core idea: what if AI didn't just help you think about your tasks — what if it could actually read them, reorganize them, and update your planner directly?

**Here's what my morning looks like now:**

1. Open my AI assistant (Claude)
2. Say: "What does today look like?"
3. AI reads my tasks and calendar, writes me a short briefing — what matters, what can wait, what I'm forgetting
4. I tell it to move things around if needed. "Push the report to Thursday. Block 90 minutes for deep work before lunch."
5. Open my planner. Everything's already reorganized.

Total time: about 90 seconds.

The tool is called [First Light](https://firstlight.to). It connects to Claude using something called MCP (Model Context Protocol) — basically a bridge that lets AI read and write your tasks directly instead of you copy-pasting everything.

Beyond the AI stuff, it also has:
- Eisenhower matrix (urgent/important triage)
- Focus timer tied to your current task
- Habit tracking
- Calendar view with Google Calendar sync
- Groups for shared workspaces

Free tier includes all the core features. The AI planning stuff is in the Pro tier ($9/mo).

The thing that surprised me most: I don't dread opening my planner anymore. When the AI writes you a morning briefing instead of showing you a wall of overdue items, the whole emotional relationship with your task list changes.

If anyone's curious, happy to share more about the workflow.

---

## 4. r/SideProject — Builder angle

**Title:** I'm a GM running 60 people by day. By night I built an AI-native task manager. Here's where it's at.

**Body:**

Hey r/SideProject — wanted to share what I've been working on.

**The product:** First Light (https://firstlight.to) — a task manager built AI-first. The headline feature: it has a native MCP server, so Claude or any AI assistant can read and write your tasks directly. No copy-pasting your to-do list into chat.

**The stack:** Next.js 14, Supabase, Lemon Squeezy, Anthropic Claude, deployed on Vercel. MCP server is open source.

**Revenue:** $0. Just launched on Product Hunt. Currently focused on distribution.

**Pricing:** Free (generous), Plus ($5/mo — calendar sync + light AI), Pro ($9/mo — full AI co-pilot).

**What I learned building it:**
- MCP is genuinely underexplored territory. Most MCP servers are demos or developer tools. Putting one in a consumer product feels different.
- The hard part isn't building features — it's making the AI actions feel trustworthy. People are nervous about AI moving their tasks around.
- i18n from day one (EN, 繁中, 简中, 日本語, 한국어) was a lot of work but opens up markets nobody else is serving.
- Writing compare/alternative pages early generates long-tail SEO traffic faster than I expected.

**What's next:** Distribution. The product is solid, the pricing is reasonable, now I need eyeballs. Trying Reddit, MCP directories, and SEO content.

Would love feedback on the landing page or the MCP integration. What would make you try it?

→ https://firstlight.to
→ https://firstlight.to/mcp
→ https://github.com/anytime-sync/anytime

---

## Posting Strategy

**Order:** Post 1-2 per day max. Don't spam.

1. **Day 1 (Saturday):** r/mcp — smallest but most targeted. Test reception.
2. **Day 2 (Sunday):** r/ClaudeAI — larger, more engagement potential.
3. **Day 3 (Monday):** r/SideProject — builder community.
4. **Day 4 (Tuesday-Wednesday):** r/productivity — largest audience, most competitive. Post when the MCP/Claude posts have some traction to reference.

**Rules:**
- Be genuine. Answer every comment.
- Don't delete and repost if it doesn't get traction.
- If someone asks a hard question, give a real answer (not marketing speak).
- Upvote other people's stuff too. Don't be a drive-by poster.
- If a post does well, edit in a thank-you and answer FAQ at the top.
