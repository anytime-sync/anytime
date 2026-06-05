import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "First Light vs Todoist — Which AI Task Manager Is Right for You?",
  description:
    "Honest comparison of First Light and Todoist. See how they differ on AI integration, MCP support, Telegram, pricing, and daily planning features.",
  keywords: [
    "first light vs todoist",
    "todoist alternative",
    "todoist vs first light",
    "best ai task manager",
    "ai task manager comparison",
    "todoist ai features",
  ],
  openGraph: {
    title: "First Light vs Todoist — Comparison",
    description:
      "Side-by-side comparison of First Light and Todoist for AI-native task management.",
    url: "https://firstlight.to/compare/todoist",
  },
  alternates: { canonical: "/compare/todoist" },
};

const features = [
  {
    "feature": "AI task planning",
    "fl": "✅ Built-in",
    "comp": "⚠️ Basic AI"
  },
  {
    "feature": "MCP integration",
    "fl": "✅ Native",
    "comp": "❌ None"
  },
  {
    "feature": "Telegram bot",
    "fl": "✅ Yes",
    "comp": "❌ No"
  },
  {
    "feature": "Eisenhower matrix",
    "fl": "✅ Built-in",
    "comp": "❌ No"
  },
  {
    "feature": "Pomodoro timer",
    "fl": "✅ Built-in",
    "comp": "❌ No"
  },
  {
    "feature": "Habit tracking",
    "fl": "✅ Built-in",
    "comp": "❌ No"
  },
  {
    "feature": "Team collaboration",
    "fl": "⚠️ Coming soon",
    "comp": "✅ Full"
  },
  {
    "feature": "Integrations",
    "fl": "✅ MCP + API",
    "comp": "✅ 100+"
  },
  {
    "feature": "Natural language input",
    "fl": "✅ AI-powered",
    "comp": "✅ Built-in"
  },
  {
    "feature": "Free tier",
    "fl": "✅ Generous",
    "comp": "✅ Limited"
  },
  {
    "feature": "Pricing",
    "fl": "$3/mo",
    "comp": "$5/mo"
  },
  {
    "feature": "Platforms",
    "fl": "Web, PWA",
    "comp": "Web, iOS, Android, Desktop"
  }
];

export default function CompareTodoistPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="px-6 pt-24 pb-12 max-w-3xl mx-auto">
        <p className="text-xs tracking-[0.22em] uppercase text-muted-fg mb-4">
          Comparison
        </p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-[1.15] mb-4">
          First Light vs Todoist
        </h1>
        <p className="text-muted-fg text-base leading-relaxed mb-2">
          Both First Light and Todoist help you organize tasks and plan your day. But they take fundamentally different approaches — Todoist is a proven productivity platform with deep integrations, while First Light is built AI-first with native MCP support, letting your AI assistant manage your tasks directly.
        </p>
        <p className="text-muted-fg text-sm">
          Last updated: June 2026
        </p>
      </section>

      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-3 bg-stone-50 border-b border-border">
            <div className="px-4 py-3 text-xs font-medium text-muted-fg uppercase tracking-wider">
              Feature
            </div>
            <div className="px-4 py-3 text-xs font-medium text-center uppercase tracking-wider">
              First Light
            </div>
            <div className="px-4 py-3 text-xs font-medium text-center text-muted-fg uppercase tracking-wider">
              Todoist
            </div>
          </div>
          {features.map((row: any, i: number) => (
            <div
              key={i}
              className={`grid grid-cols-3 border-b border-border last:border-0 ${
                i % 2 === 0 ? "" : "bg-stone-50/50"
              }`}
            >
              <div className="px-4 py-3 text-sm font-medium">{row.feature}</div>
              <div className="px-4 py-3 text-sm text-center">{row.fl}</div>
              <div className="px-4 py-3 text-sm text-center text-muted-fg">
                {row.comp}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-16 max-w-3xl mx-auto space-y-6">
        <h2 className="font-display text-2xl tracking-tight">
          When to choose First Light
        </h2>
        <ul className="space-y-2 text-sm text-muted-fg">
          <li className="flex gap-2">
            <span className="text-green-600 shrink-0">✓</span>
            You want your AI assistant (Claude, ChatGPT) to manage your tasks directly via MCP
          </li>
          <li className="flex gap-2">
            <span className="text-green-600 shrink-0">✓</span>
            You prefer adding tasks from Telegram, voice, email, or screenshots
          </li>
          <li className="flex gap-2">
            <span className="text-green-600 shrink-0">✓</span>
            You want an Eisenhower matrix + Pomodoro timer + habit tracking in one app
          </li>
          <li className="flex gap-2">
            <span className="text-green-600 shrink-0">✓</span>
            You want AI to plan your day around energy levels and priorities
          </li>
        </ul>

        <h2 className="font-display text-2xl tracking-tight">
          When to choose Todoist
        </h2>
        <ul className="space-y-2 text-sm text-muted-fg">
          <li className="flex gap-2">
            <span className="text-blue-600 shrink-0">✓</span>
            You need deep team collaboration with shared projects and comments
          </li>
          <li className="flex gap-2">
            <span className="text-blue-600 shrink-0">✓</span>
            You rely on 100+ third-party integrations (Zapier, Slack, etc.)
          </li>
          <li className="flex gap-2">
            <span className="text-blue-600 shrink-0">✓</span>
            You want a mature ecosystem with desktop, mobile, and browser extensions
          </li>
        </ul>
      </section>

      <section className="px-6 py-16 text-center">
        <h2 className="font-display text-2xl tracking-tight mb-4">
          Try First Light free
        </h2>
        <p className="text-muted-fg text-sm mb-8 max-w-md mx-auto">
          AI-native task management with MCP, Telegram, and smart daily planning.
        </p>
        <Link
          href="/signup"
          className="px-8 py-3 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          Get started free
        </Link>
      </section>
    </main>
  );
}
