import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "First Light vs TickTick — Which Task Manager Is Right for You?",
  description:
    "Honest comparison of First Light and TickTick. See how they differ on AI integration, MCP support, pricing, and daily planning.",
  keywords: [
    "first light vs ticktick",
    "ticktick alternative",
    "ticktick vs first light",
    "best ai task manager",
    "ai task manager comparison",
  ],
  openGraph: {
    title: "First Light vs TickTick",
    description: "Side-by-side comparison for AI-native task management.",
    url: "https://firstlight.to/compare/ticktick",
  },
  alternates: { canonical: "/compare/ticktick" },
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
    "comp": "✅ Built-in"
  },
  {
    "feature": "Pomodoro timer",
    "fl": "✅ Built-in",
    "comp": "✅ Built-in"
  },
  {
    "feature": "Habit tracking",
    "fl": "✅ Built-in",
    "comp": "✅ Built-in"
  },
  {
    "feature": "Calendar view",
    "fl": "⚠️ Coming soon",
    "comp": "✅ Built-in"
  },
  {
    "feature": "Native apps",
    "fl": "Web/PWA",
    "comp": "✅ All platforms"
  },
  {
    "feature": "Team collaboration",
    "fl": "⚠️ Coming soon",
    "comp": "✅ Shared lists"
  },
  {
    "feature": "Free tier",
    "fl": "✅ Generous",
    "comp": "✅ Generous"
  },
  {
    "feature": "Pricing",
    "fl": "$3/mo",
    "comp": "$35.99/yr"
  },
  {
    "feature": "Voice input",
    "fl": "✅ AI-powered",
    "comp": "✅ Built-in"
  }
];

const whenFirstLight = ["You want your AI assistant to manage tasks via MCP","You want AI to understand context and plan your day intelligently","You prefer adding tasks from Telegram, voice, email, or screenshots","You want a minimalist, focused planning experience"];
const whenCompetitor = ["You want a built-in calendar view with time blocking","You need native apps on every platform (iOS, Android, Mac, Windows)","You want team collaboration with shared lists","You prefer a free tier with more included features"];

export default function CompareTickTickPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="px-6 pt-24 pb-12 max-w-3xl mx-auto">
        <p className="text-xs tracking-[0.22em] uppercase text-muted-fg mb-4">
          Comparison
        </p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-[1.15] mb-4">
          First Light vs TickTick
        </h1>
        <p className="text-muted-fg text-base leading-relaxed mb-2">
          TickTick and First Light share several features — both have Pomodoro timers and habit tracking. But First Light goes further with native AI integration via MCP, letting your AI assistant read, create, and reorganize your tasks directly.
        </p>
        <p className="text-muted-fg text-sm">Last updated: June 2026</p>
      </section>

      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-3 bg-stone-50 border-b border-border">
            <div className="px-4 py-3 text-xs font-medium text-muted-fg uppercase tracking-wider">Feature</div>
            <div className="px-4 py-3 text-xs font-medium text-center uppercase tracking-wider">First Light</div>
            <div className="px-4 py-3 text-xs font-medium text-center text-muted-fg uppercase tracking-wider">TickTick</div>
          </div>
          {features.map((row: any, i: number) => (
            <div key={i} className={`grid grid-cols-3 border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-stone-50/50"}`}>
              <div className="px-4 py-3 text-sm font-medium">{row.feature}</div>
              <div className="px-4 py-3 text-sm text-center">{row.fl}</div>
              <div className="px-4 py-3 text-sm text-center text-muted-fg">{row.comp}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 pb-16 max-w-3xl mx-auto space-y-6">
        <h2 className="font-display text-2xl tracking-tight">When to choose First Light</h2>
        <ul className="space-y-2 text-sm text-muted-fg">
          {whenFirstLight.map((item: string, i: number) => (
            <li key={i} className="flex gap-2"><span className="text-green-600 shrink-0">✓</span>{item}</li>
          ))}
        </ul>
        <h2 className="font-display text-2xl tracking-tight">When to choose TickTick</h2>
        <ul className="space-y-2 text-sm text-muted-fg">
          {whenCompetitor.map((item: string, i: number) => (
            <li key={i} className="flex gap-2"><span className="text-blue-600 shrink-0">✓</span>{item}</li>
          ))}
        </ul>
      </section>

      <section className="px-6 py-16 text-center">
        <h2 className="font-display text-2xl tracking-tight mb-4">Try First Light free</h2>
        <p className="text-muted-fg text-sm mb-8 max-w-md mx-auto">AI-native task management with MCP, Telegram, and smart daily planning.</p>
        <Link href="/signup" className="px-8 py-3 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition">Get started free</Link>
      </section>
    </main>
  );
}
