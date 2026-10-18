import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "MCP Integration — Let Your AI Assistant Manage Your Tasks",
  description:
    "Connect a compatible MCP client to First Light with Pro access. Read and edit tasks, review planning suggestions, and work with saved calendar context.",
  keywords: [
    "MCP task manager",
    "Model Context Protocol",
    "AI task management",
    "Claude task manager",
    "AI assistant tasks",
    "MCP integration",
    "AI-native productivity",
  ],
  openGraph: {
    title: "MCP Integration — First Light",
    description:
      "Connect a compatible AI client to read and edit First Light tasks with Pro access.",
    url: "https://firstlight.to/mcp",
  },
  alternates: { canonical: "/mcp" },
};

export default function McpPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="px-6 pt-24 pb-16 max-w-3xl mx-auto text-center">
        <p className="text-xs tracking-[0.22em] uppercase text-muted-fg mb-4">
          MCP Integration
        </p>
        <h1 className="font-display text-4xl md:text-5xl tracking-tight leading-[1.15] mb-6">
          Connect your AI assistant to your tasks.
        </h1>
        <p className="text-muted-fg text-base md:text-lg max-w-xl mx-auto leading-relaxed">
          First Light supports <strong>MCP (Model Context Protocol)</strong>.
          With Pro, connect a compatible AI client and authorize access to your account.
          The client can read and edit tasks through the available tools.
          Your assistant can reason about those records; saving a change requires an editing tool.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <Link
            href="/pricing"
            className="px-6 py-3 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            See plans
          </Link>
          <a
            href="https://github.com/anytime-sync/anytime/tree/main/firstlight-mcp"
            target="_blank"
            rel="noopener"
            className="px-6 py-3 border border-border rounded-lg text-sm font-medium hover:bg-stone-50 transition"
          >
            View MCP server →
          </a>
        </div>
      </section>

      {/* What you can do */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2 className="font-display text-2xl md:text-3xl tracking-tight text-center mb-10">
          What you can say to your AI
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            {
              prompt: "Plan my day around the 2pm meeting",
              result:
                "Your assistant can read tasks and events, then propose priorities. Reading records does not create time blocks.",
            },
            {
              prompt: "What did I accomplish this week?",
              result:
                "AI pulls completed tasks, summarizes by project, and highlights what slipped.",
            },
            {
              prompt: "Add a task to review the Q3 deck by Friday",
              result:
                "Task created with title, due date, and priority — directly in your First Light planner.",
            },
            {
              prompt: "Move all overdue tasks to tomorrow and reprioritize",
              result:
                "Request overdue-date suggestions first, then ask your assistant to save the changes you choose.",
            },
            {
              prompt: "Prep me for tomorrow's board meeting",
              result:
                "Your assistant can use saved tasks and notes to draft an agenda. Creating follow-up tasks is a separate action.",
            },
            {
              prompt: "What's my highest priority right now?",
              result:
                "AI scans your Eisenhower matrix and surfaces the one thing you should do next.",
            },
          ].map(({ prompt, result }, i) => (
            <div
              key={i}
              className="border border-border rounded-xl p-5 space-y-3"
            >
              <div className="bg-violet-50 rounded-lg px-3 py-2 text-sm text-violet-900 italic">
                &ldquo;{prompt}&rdquo;
              </div>
              <p className="text-sm text-muted-fg">{result}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
        <h2 className="font-display text-2xl md:text-3xl tracking-tight text-center mb-10">
          How it works
        </h2>
        <div className="space-y-8">
          {[
            {
              step: "1",
              title: "Build the MCP server from source",
              desc: "Install Git and Node.js 20 or later. The server is available in the public repository; the old npx firstlight-mcp command is not a published package. Use a client that supports local stdio servers.",
              code: "git clone https://github.com/anytime-sync/anytime.git\ncd anytime/firstlight-mcp\nnpm ci\nnpm run build",
            },
            {
              step: "2",
              title: "Connect your account",
              desc: "On Pro, open firstlight.to/settings/api-tokens and create a token. Configure your client to run node with the absolute path to firstlight-mcp/dist/index.js. Set FIRSTLIGHT_API_KEY in its environment and keep the token private.",
              code: '{ "command": "node", "args": ["/absolute/path/to/anytime/firstlight-mcp/dist/index.js"], "env": { "FIRSTLIGHT_API_KEY": "YOUR_PRIVATE_TOKEN" } }',
            },
            {
              step: "3",
              title: "Talk naturally",
              desc: "Ask your AI to plan your day, create tasks, check what's overdue, or reorganize your week. It calls First Light directly.",
            },
          ].map(({ step, title, desc, code }) => (
            <div key={step} className="flex gap-5">
              <div className="size-10 shrink-0 rounded-full bg-accent/15 text-accent grid place-items-center font-display text-lg">
                {step}
              </div>
              <div>
                <h3 className="font-medium text-base mb-1">{title}</h3>
                <p className="text-sm text-muted-fg">{desc}</p>
                {code && (
                  <pre className="mt-2 bg-stone-100 rounded-lg px-3 py-2 text-xs font-mono text-stone-700 overflow-x-auto">
                    {code}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Available tools */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2 className="font-display text-2xl md:text-3xl tracking-tight text-center mb-10">
          MCP tools available
        </h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { name: "list_tasks", desc: "Get tasks by date, status, or priority" },
            { name: "create_task", desc: "Add a new task with full metadata" },
            { name: "update_task", desc: "Edit title, date, priority, notes" },
            { name: "complete_task", desc: "Mark a task as done" },
            { name: "delete_task", desc: "Remove a task" },
            { name: "daily_summary", desc: "Read a structured daily summary" },
            { name: "search_notes", desc: "Search saved notes" },
            { name: "list_events", desc: "Read recorded calendar events" },
            { name: "get_active_goals", desc: "Read active goals" },
          ].map(({ name, desc }) => (
            <div
              key={name}
              className="border border-border rounded-lg px-4 py-3"
            >
              <p className="font-mono text-xs text-accent mb-1">{name}</p>
              <p className="text-xs text-muted-fg">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-4">
          Stop copy-pasting your tasks into AI.
        </h2>
        <p className="text-muted-fg text-sm mb-8 max-w-md mx-auto">
          The core planner is free. API/MCP access requires Pro; AI usage limits apply.
        </p>
        <Link
          href="/pricing"
          className="px-8 py-3 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          See plans
        </Link>
      </section>
    </main>
  );
}
