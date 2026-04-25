import Link from "next/link";

const FEATURES = [
  { num: "01", kicker: "Smart views",     body: "Today, Tomorrow, Next 7 Days, Inbox — your day, organized." },
  { num: "02", kicker: "Calendar",        body: "Drag tasks between days. Plan your week visually." },
  { num: "03", kicker: "Subtasks",        body: "Break work into pieces. Track progress at a glance." },
  { num: "04", kicker: "Recurring",       body: "Daily, weekly, monthly — set it once, never miss it." },
  { num: "05", kicker: "Pomodoro",        body: "Focus cycles with breaks, all logged for later review." },
  { num: "06", kicker: "Habits",          body: "Build streaks. Show up. Compound." },
  { num: "07", kicker: "Eisenhower",      body: "Sort by urgency × importance. Decide faster." },
  { num: "08", kicker: "Tags & priorities", body: "Filter, focus, ship. Quick add accepts #tag and !1." },
];

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Wordmark */}
      <header className="px-6 pt-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-display text-2xl tracking-tight">
            Anytime
          </Link>
          <nav className="flex items-center gap-6 text-sm text-muted-fg">
            <Link href="/login" className="hover:text-fg">Log in</Link>
            <Link href="/signup" className="btn-primary px-4 h-9">Get started</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 grid place-items-center px-6 py-20">
        <div className="max-w-3xl text-center space-y-6">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-fg">
            Anytime — A calm operating system for getting things done
          </p>
          <h1 className="font-display text-5xl md:text-7xl leading-[1.05] tracking-tight">
            Plan with intent,
            <br />
            <em className="font-display">live with flow.</em>
          </h1>
          <p className="text-base md:text-lg text-muted-fg max-w-xl mx-auto">
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

      {/* Editorial divider */}
      <div className="max-w-6xl w-full mx-auto px-6">
        <div className="h-px bg-border" />
      </div>

      {/* Features grid — magazine columns */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="editorial-number text-sm">In this issue</p>
            <h2 className="font-display text-3xl md:text-4xl mt-1">
              <em>Everything</em> you need.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
            {FEATURES.map(({ num, kicker, body }) => (
              <article key={num} className="space-y-2">
                <div className="editorial-number text-xs">{num}</div>
                <h3 className="font-display text-xl leading-tight">{kicker}</h3>
                <p className="text-sm text-muted-fg leading-relaxed">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-fg">
          <span>© Anytime · Built with Next.js, Supabase &amp; Tailwind.</span>
          <a
            href="https://github.com/anytime-sync/anytime"
            className="hover:text-fg"
          >
            Source on GitHub →
          </a>
        </div>
      </footer>
    </main>
  );
}
