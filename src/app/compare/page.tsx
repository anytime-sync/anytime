import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Compare First Light — How We Stack Up Against Other Task Managers",
  description:
    "See how First Light compares to Todoist, Things 3, and TickTick. Honest, side-by-side feature comparisons for AI-native task management.",
  keywords: [
    "task manager comparison",
    "best task manager 2026",
    "todoist alternative",
    "things alternative",
    "ticktick alternative",
    "ai task manager",
  ],
  alternates: { canonical: "/compare" },
};

const comparisons = [
  {
    slug: "todoist",
    name: "Todoist",
    tagline: "The productivity platform with 100+ integrations",
    diff: "First Light brings native AI planning and MCP; Todoist brings team collaboration and a mature ecosystem.",
  },
  {
    slug: "things",
    name: "Things 3",
    tagline: "The beautifully designed Apple-native task manager",
    diff: "First Light is cross-platform and AI-first; Things 3 is Apple-only with unmatched design polish.",
  },
  {
    slug: "ticktick",
    name: "TickTick",
    tagline: "The all-in-one with focus timer, habits, and calendar",
    diff: "Both have focus timer and habits. First Light adds native MCP and AI-powered daily planning.",
  },
];

export default function ComparePage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="px-6 pt-24 pb-16 max-w-3xl mx-auto">
        <p className="text-xs tracking-[0.22em] uppercase text-muted-fg mb-4">
          Comparisons
        </p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-[1.15] mb-6">
          How First Light compares
        </h1>
        <p className="text-muted-fg text-base leading-relaxed">
          Honest, side-by-side comparisons. We tell you when to pick us —
          and when the other tool might be a better fit.
        </p>
      </section>

      <section className="px-6 pb-20 max-w-3xl mx-auto space-y-4">
        {comparisons.map((c) => (
          <Link
            key={c.slug}
            href={"/compare/" + c.slug}
            className="block border border-border rounded-xl p-6 hover:border-foreground/20 transition group"
          >
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-display text-xl tracking-tight group-hover:underline">
                First Light vs {c.name}
              </h2>
              <span className="text-xs text-muted-fg">→</span>
            </div>
            <p className="text-xs text-muted-fg mb-2">{c.tagline}</p>
            <p className="text-sm text-muted-fg">{c.diff}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
