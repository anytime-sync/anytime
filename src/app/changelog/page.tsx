import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Changelog — First Light",
  description:
    "What's new in First Light. Product updates, new features, and improvements to your calm daily productivity tool.",
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "Changelog — First Light",
    description: "Product updates and new features.",
    url: "https://firstlight.to/changelog",
    images: ["/og.png"],
  },
};

type Entry = {
  date: string;
  version?: string;
  title: string;
  items: string[];
  tag: "new" | "improved" | "fixed";
};

const CHANGELOG: Entry[] = [
  {
    date: "2026-06-04",
    title: "Newsletter & Announcements",
    tag: "new",
    items: [
      "In-app announcement banners with customizable colors",
      "Newsletter broadcast system — send updates to all users or by plan",
      "Admin Format page for per-announcement color control",
    ],
  },
  {
    date: "2026-06-04",
    title: "Blog & Content",
    tag: "new",
    items: [
      "Launch blog with editorial productivity content",
      "Comparison guide: First Light vs Todoist, Things, TickTick",
      "SEO foundation: sitemap, structured data, per-page metadata",
    ],
  },
  {
    date: "2026-06-04",
    title: "Pricing & Plans",
    tag: "new",
    items: [
      "Public pricing page with Free, Plus, and Pro tiers",
      "Feature comparison matrix",
      "Lemon Squeezy / Stripe checkout integration",
    ],
  },
  {
    date: "2026-06-03",
    title: "Daily Edition & AI",
    tag: "improved",
    items: [
      "AI-powered morning briefing — your day as a newspaper editorial",
      "Plan-my-day conversational planner (Pro)",
      "Voice-to-task and snapshot-to-task (Pro)",
      "Smart triage with AI Eisenhower matrix (Pro)",
    ],
  },
  {
    date: "2026-06-01",
    title: "Core Task System",
    tag: "new",
    items: [
      "Today, Tomorrow, Next 7 days, Next 90 days, Inbox views",
      "Google Calendar sync (read on Free, two-way on Plus+)",
      "Lists, Tags, Groups, Habits, Notes",
      "Focus / Pomodoro mode",
      "5 languages: EN, ZH-TW, ZH-CN, JA, KO",
      "Progressive Web App — works on any device",
    ],
  },
];

const TAG_STYLES: Record<string, string> = {
  new: "bg-emerald-100 text-emerald-800",
  improved: "bg-blue-100 text-blue-800",
  fixed: "bg-amber-100 text-amber-800",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="wordmark text-base">
            First Light
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/pricing"
              className="text-muted-fg hover:text-fg transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/blog"
              className="text-muted-fg hover:text-fg transition-colors"
            >
              Blog
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <header className="mb-12">
          <h1 className="font-display text-4xl md:text-5xl tracking-tight mb-3">
            Changelog
          </h1>
          <p className="text-muted-fg text-base leading-relaxed max-w-lg">
            New features, improvements, and fixes. Subscribe to the{" "}
            <Link href="/blog" className="underline underline-offset-2">
              blog
            </Link>{" "}
            for detailed write-ups.
          </p>
        </header>

        <div className="space-y-12">
          {CHANGELOG.map((entry, i) => (
            <article key={i} className="relative pl-6 border-l-2 border-border">
              <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-accent border-2 border-bg" />
              <div className="flex items-center gap-3 mb-2">
                <time className="text-xs text-muted-fg font-mono">
                  {entry.date}
                </time>
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${TAG_STYLES[entry.tag]}`}
                >
                  {entry.tag}
                </span>
              </div>
              <h2 className="font-display text-xl tracking-tight mb-3">
                {entry.title}
              </h2>
              <ul className="space-y-1.5 text-sm text-muted-fg">
                {entry.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <span className="text-accent mt-0.5">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </main>

      <footer className="border-t border-border mt-16 py-6">
        <div className="max-w-3xl mx-auto px-6 flex items-center justify-between text-xs text-muted-fg">
          <span>© First Light</span>
          <nav className="flex gap-4">
            <Link href="/privacy" className="hover:text-fg">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-fg">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
