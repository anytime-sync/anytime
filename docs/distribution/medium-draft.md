# Medium Article Draft — First Light Distribution
## Ready to paste into Medium. Use "Import a story" for canonical URL support.

---

# I Replaced My Morning Planning Routine With an AI That Actually Moves My Tasks Around

Every productivity system I've tried shares the same flaw: they give you a list and walk away.

I've used Todoist, Things, TickTick, Notion, and bullet journals. At various points I was convinced each one was "the system." But after the initial honeymoon, I'd always end up in the same place: staring at a screen full of overdue tasks, trying to figure out what actually matters today.

Lists don't plan your day. They just remind you how much you haven't done.

## The copy-paste ritual

About a year ago, I started using Claude (Anthropic's AI) for daily planning. My workflow looked like this:

1. Open my task manager
2. Copy or screenshot my tasks
3. Paste them into Claude
4. Ask: "Help me prioritize — I have a 2pm meeting and a deadline Friday"
5. Claude gives me a beautiful, thoughtful plan
6. I manually rearrange my task manager to match

It worked. Claude is genuinely good at this — it understands urgency, energy management, time-boxing, the whole thing. But the process was absurd. I was using an AI that could reason about my entire week, and I was the slow bottleneck copying data between two tabs.

The AI couldn't see my calendar. It couldn't check what was overdue. It couldn't mark anything done.

## What changed: MCP

Late 2024, Anthropic released something called MCP — Model Context Protocol. The short version: it lets AI assistants plug into external tools directly. Instead of you telling Claude what's on your calendar, Claude checks your calendar itself.

Think of it as USB for AI. You connect a "server" (your task manager, your calendar, whatever), and the AI can read from it and act on it.

When I saw MCP, the first thing I thought was: why isn't my task manager on this?

I checked. Todoist — no MCP server. Things — no. TickTick — no. None of the major task managers had one.

So I built one.

## What my morning looks like now

I run a consumer brands division — about 60 people, multiple product lines, back-to-back meetings most days. Here's my actual morning workflow now:

1. Open Claude
2. "Good morning. What does today look like?"
3. Claude reads my tasks and Google Calendar directly — no copy-pasting — and writes me a short briefing. What's urgent. What can wait. What I'm forgetting.
4. "Push the deck review to Thursday. Block 90 minutes for deep work before the 11am call."
5. Done. My planner already reflects the changes.

About 90 seconds. No dragging cards around. No staring at a list trying to decide what to do first.

The emotional shift surprised me most. When your planner shows you a calm briefing instead of a wall of overdue items, your whole relationship with your task list changes. You actually want to open it.

## The part nobody talks about: trust

The hardest part of building this wasn't the technology. It was trust.

When I first showed people an AI that could move their tasks around, the reaction was always the same: "That's cool, but I don't want AI touching my stuff."

Fair. I felt the same way initially.

What made it work was transparency. Every action Claude takes shows up immediately in the app. You see exactly what changed. If it moved something you didn't want moved, you undo it. The AI proposes; you dispose.

Over time, you start trusting it the way you trust autocorrect — it's right 95% of the time, and the 5% is easy to fix. The time savings are worth the occasional correction.

## Beyond the AI trick

The AI integration is the headline feature, but it's not the whole product. Underneath, First Light is a proper daily planner:

- **Eisenhower matrix** — auto-triage tasks by urgency and importance
- **Focus timer** — tied to your current task, so your time tracking is automatic
- **Habits** — daily streaks with visual progress
- **Calendar sync** — Google Calendar integration so tasks and events live together
- **Groups** — shared task spaces for teams
- **Morning briefing** — even without AI, the app generates a structured view of your day

The AI layer sits on top of all this. It's powerful, but the app works fine without it too.

## The uncomfortable question

I'll be honest about something: I don't know if this is a business yet.

The app is free to start. The AI features are $9/month. I'm the only developer, building this nights and weekends while running a 60-person division during the day.

The tech works. The workflow is genuinely better than what I had before. Whether enough people feel the same way to make it sustainable — that's the experiment I'm running right now.

What I do know: the gap between "AI gives me advice" and "AI takes action on my behalf" is where the next wave of productivity tools will live. Most apps are still in the advice phase. I wanted to build something in the action phase.

## If you want to try it

[First Light](https://firstlight.to) — free tier includes all the core features (tasks, habits, calendar, focus timer, Eisenhower matrix). The AI planning and MCP integration are in the Pro tier.

If you use Claude Desktop, the MCP setup takes about two minutes: [firstlight.to/mcp](https://firstlight.to/mcp)

I wrote a more technical walkthrough on the blog: [How to Manage Tasks with Claude Using MCP](https://firstlight.to/blog/manage-tasks-with-claude-mcp)

I'm genuinely curious: how are other people combining AI with their task management? Am I overengineering my to-do list, or is this actually the future? I'd love to hear what's working for you.

---

## Medium Publishing Notes

**Title:** I Replaced My Morning Planning Routine With an AI That Actually Moves My Tasks Around

**Subtitle:** The gap between "AI gives me advice" and "AI takes action" is where productivity tools are headed.

**Tags (pick up to 5):**
1. Productivity
2. Artificial Intelligence
3. Task Management
4. Self Improvement
5. Technology

**Publication:** Submit to one of these (increases reach):
- "Better Programming" (if they take it — technical angle)
- "The Startup" (builder/founder angle)
- "Towards AI" (AI angle)
- Or just publish on your own profile first — you can add to publications later

**Canonical URL:** Set to https://firstlight.to/blog/manage-tasks-with-claude-mcp
(Medium supports this: when creating story, click "..." → "Story settings" → "Canonical URL")
Wait — this is a DIFFERENT article from the blog post. Don't set canonical unless you also publish this exact text on firstlight.to.

Actually: **Don't set canonical.** This is original Medium content. Let it rank on its own. Your blog post is a different article (tutorial format). This one is personal narrative. Two different pieces = two chances to rank.

**Import option:** Don't use "Import a story" — that's for republishing existing content. This is new.

**When to publish:** Weekday morning US time (Tue-Thu, 8-11am ET) gets the best Medium distribution. So hold this until Monday or Tuesday.
