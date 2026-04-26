import Link from "next/link";

const PRINCIPLES = [
  {
    kicker: "01",
    title: "Clarity",
    body: "Clear thinking, clear direction.",
    Glyph: SmallSun,
  },
  {
    kicker: "02",
    title: "Focus",
    body: "One thing at a time.",
    Glyph: BeamLight,
  },
  {
    kicker: "03",
    title: "Progress",
    body: "Small steps create big change.",
    Glyph: SunHorizon,
  },
  {
    kicker: "04",
    title: "Calm",
    body: "Peaceful mind, productive life.",
    Glyph: SoftOrb,
  },
  {
    kicker: "05",
    title: "Light",
    body: "Inspiration to move forward.",
    Glyph: RadialSun,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Wordmark */}
      <header className="px-6 pt-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="wordmark text-base">
            First Light
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
          <p className="editorial-number text-xs">
            First Light · A calm operating system for getting things done
          </p>
          <h1 className="font-display text-5xl md:text-7xl leading-[1.05] tracking-tight">
            Plan with intent,
            <br />
            <em className="font-display">light with purpose.</em>
          </h1>
          <p className="text-base md:text-lg text-muted-fg max-w-xl mx-auto">
            Tasks, calendar, habits, and Pomodoro — synced across every device.
            A daily editorial briefing that keeps your day on the page,
            not on fire.
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

      {/* Brand principles */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="editorial-number text-xs">Brand principles</p>
            <h2 className="font-display text-3xl md:text-4xl mt-2">
              <em>Five</em> intentions, every day.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-12">
            {PRINCIPLES.map(({ kicker, title, body, Glyph }) => (
              <article key={kicker} className="space-y-3 text-center">
                <Glyph className="size-16 mx-auto text-accent" />
                <div className="editorial-number text-[10px]">{kicker}</div>
                <h3 className="font-display text-xl leading-tight">{title}</h3>
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

/* ---------- Five sun glyphs (warm gold, currentColor-driven) ---------- */

/** 01 Clarity — small delicate sun, fewer rays, sharp edges. */
function SmallSun({ className }: { className?: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <circle cx="32" cy="32" r="6.5" />
      {rays.map((deg, i) => (
        <line key={i} x1="32" y1="18" x2="32" y2="13"
          transform={`rotate(${deg} 32 32)`} />
      ))}
    </svg>
  );
}

/** 02 Focus — concentrated vertical beam through a circle. */
function BeamLight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <defs>
        <linearGradient id="beam" x1="32" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="30" y="3" width="4" height="58" fill="url(#beam)" stroke="none" rx="2" />
      <circle cx="32" cy="32" r="11" />
      <circle cx="32" cy="32" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 03 Progress — half sun rising over horizon lines. */
function SunHorizon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      {/* half sun */}
      <path d="M 18 36 a 14 14 0 0 1 28 0" />
      {/* horizon lines, longest top, tapering down */}
      <line x1="10" y1="42" x2="54" y2="42" />
      <line x1="14" y1="48" x2="50" y2="48" />
      <line x1="18" y1="54" x2="46" y2="54" />
    </svg>
  );
}

/** 04 Calm — soft glowing orb, no rays, gradient. */
function SoftOrb({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <radialGradient id="orb" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="currentColor" stopOpacity="0.55" />
          <stop offset="60%" stopColor="currentColor" stopOpacity="0.20" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="22" fill="url(#orb)" />
      <circle cx="32" cy="32" r="14" fill="currentColor" fillOpacity="0.15" />
    </svg>
  );
}

/** 05 Light — full radial sun, many long rays. */
function RadialSun({ className }: { className?: string }) {
  const rays = Array.from({ length: 16 }, (_, i) => i * 22.5);
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
      <circle cx="32" cy="32" r="7" />
      {rays.map((deg, i) => (
        <line key={i} x1="32" y1="20" x2="32" y2="9"
          transform={`rotate(${deg} 32 32)`} />
      ))}
    </svg>
  );
}
