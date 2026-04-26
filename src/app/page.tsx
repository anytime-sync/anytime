import Link from "next/link";

const PRINCIPLES = [
  { kicker: "01", title: "Clarity",  body: "Clear thinking, clear direction." },
  { kicker: "02", title: "Focus",    body: "One thing at a time." },
  { kicker: "03", title: "Progress", body: "Small steps create big change." },
  { kicker: "04", title: "Calm",     body: "Peaceful mind, productive life." },
  { kicker: "05", title: "Light",    body: "Inspiration to move forward." },
];

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-6 pt-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="wordmark text-base">First Light</Link>
          <nav className="flex items-center gap-6 text-sm text-muted-fg">
            <Link href="/login" className="hover:text-fg">Log in</Link>
            <Link href="/signup" className="btn-primary px-4 h-9">Get started</Link>
          </nav>
        </div>
      </header>

      <section className="flex-1 grid place-items-center px-6 py-20">
        <div className="max-w-3xl text-center space-y-6">
          <p className="editorial-number text-xs">First Light · Calm OS for getting things done</p>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.05] tracking-tight">
            Your space for clarity, focus,
            <br />
            and intentional progress.
          </h1>
          <p className="text-base md:text-lg text-muted-fg max-w-xl mx-auto">
            Tasks, calendar, habits, Pomodoro — and a daily editorial briefing
            that keeps your day on the page, not on fire.
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
            No credit card. No tracking. Real-time sync.
          </p>
        </div>
      </section>

      <div className="max-w-6xl w-full mx-auto px-6">
        <div className="h-px bg-border" />
      </div>

      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="editorial-number text-xs">Brand principles</p>
            <h2 className="font-display text-3xl md:text-4xl mt-2">
              Five intentions, every day.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-10">
            {PRINCIPLES.map(({ kicker, title, body }) => (
              <article key={kicker} className="space-y-3 text-center">
                <SunMark className="size-10 mx-auto text-accent" />
                <div className="editorial-number text-[10px]">{kicker}</div>
                <h3 className="font-display text-lg leading-tight">{title}</h3>
                <p className="text-sm text-muted-fg leading-relaxed">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-muted-fg">
          <span>© First Light · Built with Next.js, Supabase &amp; Tailwind.</span>
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

/** Small inline sun mark — renders the brand glyph at any size via currentColor. */
function SunMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      fill="none"
      aria-hidden
    >
      <line x1="32" y1="6"  x2="32" y2="12" />
      <line x1="32" y1="52" x2="32" y2="58" />
      <line x1="6"  y1="32" x2="12" y2="32" />
      <line x1="52" y1="32" x2="58" y2="32" />
      <line x1="13" y1="13" x2="17" y2="17" />
      <line x1="47" y1="47" x2="51" y2="51" />
      <line x1="13" y1="51" x2="17" y2="47" />
      <line x1="47" y1="17" x2="51" y2="13" />
      <line x1="22" y1="8"  x2="24" y2="13" />
      <line x1="42" y1="8"  x2="40" y2="13" />
      <line x1="22" y1="56" x2="24" y2="51" />
      <line x1="42" y1="56" x2="40" y2="51" />
      <circle cx="32" cy="32" r="11" />
      <circle cx="32" cy="32" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}
