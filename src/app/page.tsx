import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Hash,
  LayoutGrid,
  ListTree,
  Sparkles,
  Sun,
} from "lucide-react";

const FEATURES = [
  { icon: Sun, title: "Smart views", body: "Today, Tomorrow, Next 7 Days, Inbox — your day, organized." },
  { icon: CalendarDays, title: "Calendar", body: "Drag tasks between days. Plan your week visually." },
  { icon: ListTree, title: "Subtasks", body: "Break work into pieces. Track progress at a glance." },
  { icon: CheckCircle2, title: "Recurring tasks", body: "Daily, weekly, monthly — set it once, never miss it." },
  { icon: Clock, title: "Pomodoro", body: "Focus cycles with breaks, all logged for later review." },
  { icon: Sparkles, title: "Habits", body: "Build streaks. Show up. Compound." },
  { icon: LayoutGrid, title: "Eisenhower", body: "Sort by urgency × importance. Decide faster." },
  { icon: Hash, title: "Tags & priorities", body: "Filter, focus, ship. Quick add accepts #tag and !1." },
];

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <section className="flex-1 grid place-items-center px-6 py-20">
        <div className="max-w-3xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 h-8 rounded-full border border-border text-xs text-muted-fg">
            <span className="size-1.5 rounded-full bg-success" />
            Now live
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            A calm place to <span className="text-accent">get things done</span>.
          </h1>
          <p className="text-lg text-muted-fg max-w-xl mx-auto">
            Tasks, calendar, habits, and Pomodoro — synced across every device.
            Open-source. Yours.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link href="/signup" className="btn-primary px-5 h-11">
              Get started — free
            </Link>
            <Link href="/login" className="btn-outline px-5 h-11">
              Log in
            </Link>
          </div>
          <p className="text-xs text-muted-fg pt-2">
            No credit card. No tracking. Real-time sync via Supabase.
          </p>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card p-5 space-y-2">
              <Icon className="size-5 text-accent" />
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-muted-fg">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-6 py-8 border-t border-border text-center text-xs text-muted-fg">
        Built with Next.js, Supabase, and Tailwind ·{" "}
        <a
          href="https://github.com/anytime-sync/anytime"
          className="text-accent hover:underline"
        >
          source on GitHub
        </a>
      </footer>
    </main>
  );
}
