import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "First Light vs Things 3 — Which Task Manager Is Right for You?",
  description:
    "Honest comparison of First Light and Things 3. See how they differ on AI integration, MCP support, pricing, and daily planning.",
  keywords: [
    "first light vs things",
    "things alternative",
    "things vs first light",
    "best ai task manager",
    "ai task manager comparison",
  ],
  openGraph: {
    title: "First Light vs Things 3",
    description: "Side-by-side comparison for AI-native task management.",
    url: "https://firstlight.to/compare/things",
  },
  alternates: { canonical: "/compare/things" },
};

const features = [
  {
    "feature": "AI task planning",
    "fl": "✅ Built-in",
    "comp": "❌ None"
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
    "feature": "Native Apple apps",
    "fl": "❌ Web/PWA",
    "comp": "✅ Mac, iPhone, iPad, Watch"
  },
  {
    "feature": "Offline support",
    "fl": "⚠️ PWA cache",
    "comp": "✅ Full offline"
  },
  {
    "feature": "One-time purchase",
    "fl": "❌ Subscription",
    "comp": "✅ $49.99 Mac + $9.99 iOS"
  },
  {
    "feature": "Cross-platform",
    "fl": "✅ Any browser",
    "comp": "❌ Apple only"
  },
  {
    "feature": "Areas & projects",
    "fl": "✅ Projects",
    "comp": "✅ Areas + Projects"
  },
  {
    "feature": "Quick entry",
    "fl": "✅ AI + Telegram",
    "comp": "✅ Quick Entry + Mail to Things"
  }
];

const whenFirstLight = ["You want your AI assistant to manage tasks via MCP","You need cross-platform access (Windows, Android, Linux)","You want Pomodoro, habits, and Eisenhower matrix built in","You prefer AI-powered daily planning"];
const whenCompetitor = ["You live in the Apple ecosystem and want polished native apps","You prefer one-time purchase over subscription","You want full offline support with no internet required","Design polish is your #1 priority"];

export default function CompareThings3Page() {
  return (
    <main className="min-h-screen bg-background">
      <section className="px-6 pt-24 pb-12 max-w-3xl mx-auto">
        <p className="text-xs tracking-[0.22em] uppercase text-muted-fg mb-4">
          Comparison
        </p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-[1.15] mb-4">
          First Light vs Things 3
        </h1>
        <p className="text-muted-fg text-base leading-relaxed mb-2">
          Things 3 is beloved for its beautiful design and native Apple experience. First Light takes a different approach — AI-first task management with MCP integration, letting your AI assistant plan your day directly.
        </p>
        <p className="text-muted-fg text-sm">Last updated: June 2026</p>
      </section>

      <section className="px-6 pb-16 max-w-3xl mx-auto">
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-3 bg-stone-50 border-b border-border">
            <div className="px-4 py-3 text-xs font-medium text-muted-fg uppercase tracking-wider">Feature</div>
            <div className="px-4 py-3 text-xs font-medium text-center uppercase tracking-wider">First Light</div>
            <div className="px-4 py-3 text-xs font-medium text-center text-muted-fg uppercase tracking-wider">Things 3</div>
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
        <h2 className="font-display text-2xl tracking-tight">When to choose Things 3</h2>
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
