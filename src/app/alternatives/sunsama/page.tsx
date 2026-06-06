import Link from "next/link";
import { loadPrices, formatPrice } from "@/lib/pricing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "First Light vs Sunsama — an honest comparison",
  description:
    "Looking for a Sunsama alternative? An honest comparison of First Light vs Sunsama — calm productivity, AI Plan-my-day, voice/snapshot/paste to task, two-way Google Calendar.",
  alternates: { canonical: "/alternatives/sunsama" },
  openGraph: {
    title: "First Light vs Sunsama — an honest comparison",
    description:
      "Calm productivity instead of streaks. Daily brief, AI Plan-my-day, voice/snapshot/paste to task, two-way Google Calendar.",
    url: "https://firstlight.to/alternatives/sunsama",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "First Light vs Sunsama — an honest comparison",
    description: "Calm productivity instead of streaks.",
    images: ["/og.png"],
  },
};

export default async function FirstLightVsSunsama() {
  const { plusCents, proCents, currency } = await loadPrices();
  const plusFmt = formatPrice(plusCents, currency);
  const proFmt = formatPrice(proCents, currency);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "First Light vs Sunsama — an honest comparison",
    datePublished: "2026-05-30",
    dateModified: "2026-05-30",
    author: { "@type": "Organization", "name": "First Light" },
    publisher: {
      "@type": "Organization",
      name: "First Light",
      logo: { "@type": "ImageObject", url: "https://firstlight.to/icons/icon.svg" },
    },
    mainEntityOfPage: "https://firstlight.to/alternatives/sunsama",
  };
  const rows: [string, string, string][] = [
    ["Daily morning brief", "—", "Daily Edition · editorial"],
    ["AI Plan-my-day", "—", "Yes · 4-quadrant + reasoning"],
    ["Voice to task", "—", "Yes"],
    ["Snapshot to task", "—", "Yes"],
    ["Paste screenshot to task", "—", "Yes"],
    ["Two-way Google Calendar", "One-way display", "Two-way drag-to-reschedule"],
    ["Weekly review", "—", "Friday Review + Next-week Preview"],
    ["Semantic search", "—", "Yes"],
    ["Natural-language input", "Best-in-class", "Good, improving"],
    ["Native iOS / Android apps", "Yes", "PWA only (today)"],
    ["Public API", "Yes", "—"],
    ["Karma / streaks", "Yes", "Intentionally none"],
    ["Project hierarchy", "Projects · Sections · Subtasks", "Lists + Groups"],
    ["Team collaboration", "Yes", "Groups (shared lists)"],
    ["Free plan", "5 personal projects", "Generous · Daily Edition included"],
    ["Paid entry tier", "$5/mo Pro (annual only)", `${plusFmt}/mo Plus (monthly)`],
  ];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-stone-50 text-stone-900">
        <header className="px-6 pt-6">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <Link href="/" className="wordmark text-sm tracking-[0.18em]">
              FIRST LIGHT
            </Link>
            <nav className="flex items-center gap-5 text-sm text-stone-600">
              <Link href="/pricing" className="hover:text-stone-900">Pricing</Link>
              <Link href="/signup" className="hover:text-stone-900">Sign up</Link>
            </nav>
          </div>
        </header>

        <article className="max-w-3xl mx-auto px-6 py-16 space-y-10">
          <div className="space-y-3">
            <p className="editorial-number text-[10px] tracking-[0.22em] text-amber-700">
              COMPARISON · MAY 2026
            </p>
            <h1 className="font-display text-4xl md:text-5xl leading-tight tracking-tight">
              First Light vs Sunsama — an honest comparison
            </h1>
            <p className="text-stone-600 text-lg leading-relaxed">
              You probably found this page because Sunsama&rsquo;s streaks and karma points started feeling
              like work about work. We&rsquo;ve been there. Here&rsquo;s how the two tools actually differ —
              including the parts where Sunsama is still the better pick.
            </p>
          </div>

          <section className="rounded-2xl border border-stone-200 bg-white/60 p-6 space-y-3">
            <p className="editorial-number text-[10px] tracking-[0.22em] text-stone-500">THE QUICK VERDICT</p>
            <p className="leading-relaxed">
              <strong>Pick Sunsama</strong> if you want a battle-tested cross-platform task manager with deep
              native apps, natural-language parsing, and a project hierarchy you can lean on. It&rsquo;s the
              safe choice and it works.
            </p>
            <p className="leading-relaxed">
              <strong>Pick First Light</strong> if you want a calm daily rhythm instead of a backlog. A morning
              brief that&rsquo;s read once and closed. AI that re-sorts your day around your energy. Snapshot,
              voice, or paste a screenshot to get tasks. Two-way Google Calendar sync. No streaks, no karma,
              no badges — by design.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl md:text-3xl">The honest case for Sunsama</h2>
            <p className="leading-relaxed text-stone-700">
              Sunsama has been shipping since 2007 and it shows. The natural-language parser is
              industry-leading — type &ldquo;Submit invoice every other Friday at 3pm&rdquo; and it just
              works. Native apps on iOS, Android, macOS, Windows, Linux, Apple Watch, and a respected REST
              API. If you live across 5 devices and you need bulletproof sync, Sunsama has had a decade head
              start on getting that right.
            </p>
            <p className="leading-relaxed text-stone-700">
              The project hierarchy (Projects → Sections → Tasks → Subtasks) maps cleanly onto how a lot of
              people think. Saved filters with Boolean search are powerful once you internalize the syntax.
              Karma points and streaks, while controversial, do work for a non-trivial share of users — if
              external motivation lights you up, that&rsquo;s a real feature, not a bug.
            </p>
            <p className="leading-relaxed text-stone-700">
              We don&rsquo;t pretend First Light replaces this. It doesn&rsquo;t. If your daily life is
              &ldquo;100+ tasks across 12 projects on 4 platforms with team collaboration,&rdquo; Sunsama Pro
              at $5/mo is a reasonable answer and we&rsquo;d be lying if we said otherwise.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl md:text-3xl">The honest case for First Light</h2>
            <p className="leading-relaxed text-stone-700">
              First Light is built on a different thesis: most people don&rsquo;t have a task-management
              problem. They have an attention problem. The fix isn&rsquo;t a better backlog. It&rsquo;s a calm
              rhythm — read your day once in the morning, let AI shape it around your energy, work
              uninterrupted in deep blocks, close the day with a 30-second reflection, and get a Friday-style
              retro on the week.
            </p>
            <p className="leading-relaxed text-stone-700">
              Concretely, that translates into surfaces Sunsama doesn&rsquo;t have:
            </p>
            <ul className="space-y-3 ml-6 list-disc text-stone-700">
              <li><strong>Daily Edition.</strong> An editorial morning brief — written like a Sunday newspaper column — that pulls from tasks, calendar, notes, and goals. Read once, then closed. Not a checklist, not a backlog scroll.</li>
              <li><strong>AI Plan-my-day.</strong> Re-sorts today&rsquo;s tasks into the four Eisenhower quadrants and explains its reasoning. Apply all, apply some, ignore. The point isn&rsquo;t the sort — it&rsquo;s the conversation.</li>
              <li><strong>Snapshot / Voice / Paste to task.</strong> Photograph a whiteboard, voice-record an idea, paste a screenshot of a Slack thread, or even paste meeting notes — AI extracts every task with the right date and priority.</li>
              <li><strong>Two-way Google Calendar.</strong> Tasks and events on one grid. Drag a task — it creates a GCal event. Drag a GCal event — it reschedules. Real two-way, not display-only.</li>
              <li><strong>Friday Weekly Review + Next-week Preview.</strong> Close last week. Pre-stage the next one with deep-work blocks scheduled around your peaks.</li>
              <li><strong>Semantic search.</strong> Search &ldquo;things I decided about Q4 pricing&rdquo; and find the right notes, tasks, and reflections — without keyword gymnastics.</li>
              <li><strong>Calmness as a feature.</strong> No streaks. No karma points. No &ldquo;you missed 3 days!&rdquo; nudges. The product is allowed to be quiet.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl md:text-3xl">Feature-by-feature</h2>
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-stone-300">
                    <th className="text-left font-medium py-3 pr-4">Feature</th>
                    <th className="text-left font-medium py-3 px-4">Sunsama</th>
                    <th className="text-left font-medium py-3 px-4">First Light</th>
                  </tr>
                </thead>
                <tbody className="text-stone-700">
                  {rows.map(([feat, t, f]) => (
                    <tr key={feat} className="border-b border-stone-200">
                      <td className="py-3 pr-4 font-medium text-stone-900">{feat}</td>
                      <td className="py-3 px-4">{t}</td>
                      <td className="py-3 px-4">{f}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl md:text-3xl">Pricing</h2>
            <p className="leading-relaxed text-stone-700">
              Both products have free tiers that actually work. The paid plans are priced similarly, but the
              structure differs.
            </p>
            <ul className="space-y-2 ml-6 list-disc text-stone-700">
              <li><strong>Sunsama Free:</strong> 5 personal projects, 5 collaborators per project, 1-week activity history.</li>
              <li><strong>Sunsama Pro:</strong> $5/mo billed annually only (so $4/mo if you commit to 12 months). 300 projects, reminders, calendar feeds.</li>
              <li><strong>First Light Free:</strong> Daily Edition included. All capture (typing). Calendar, Inbox, Today, Next 7 / Next 90, The Sift.</li>
              <li><strong>First Light Plus ({plusFmt}/mo):</strong> Billed monthly (no annual lock-in). Voice / Snapshot / Paste to task. Weekly Review. Two-way GCal. Semantic search.</li>
              <li><strong>First Light Pro ({proFmt}/mo):</strong> AI Plan-my-day. AI Plan-my-week. AI Goal Tracker. Morning Co-pilot. Priority human support.</li>
            </ul>
            <p className="leading-relaxed text-stone-700">
              The Plus tier is deliberately monthly because First Light is new and we&rsquo;d rather earn your
              re-subscription each month than lock you into a year.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl md:text-3xl">Who should pick what</h2>
            <p className="leading-relaxed text-stone-700">
              <strong>Pick Sunsama if:</strong> you need cross-device sync across 4+ platforms; you have an
              active developer integration (API/webhooks); you respond well to gamification; your work is
              high-volume task triage; you collaborate on shared projects with non-technical teammates.
            </p>
            <p className="leading-relaxed text-stone-700">
              <strong>Pick First Light if:</strong> you&rsquo;re a founder, designer, writer, or knowledge
              worker whose problem isn&rsquo;t volume but focus; you live in Google Calendar; you take messy
              notes (photos, voice memos, pasted Slack threads) and want them to become tasks without manual
              re-entry; you want AI to shape your day instead of you re-sorting it; you&rsquo;ve quietly
              turned off Sunsama&rsquo;s karma feature because it made you anxious.
            </p>
          </section>

          <section className="rounded-2xl bg-amber-50/60 border border-amber-200 p-8 text-center space-y-4">
            <p className="editorial-number text-[10px] tracking-[0.22em] text-amber-700">TRY IT</p>
            <h2 className="font-display text-3xl">A calm place to get things done.</h2>
            <p className="text-stone-700 max-w-xl mx-auto leading-relaxed">
              Free to start. No credit card. Daily Edition included on the free tier so you can read your
              morning brief before deciding whether to upgrade.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center h-11 px-5 rounded-md bg-stone-900 text-white font-medium hover:bg-stone-800"
              >
                Start free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center h-11 px-5 rounded-md border border-stone-300 text-stone-900 hover:border-stone-500"
              >
                See pricing
              </Link>
            </div>
          </section>

          <footer className="pt-8 border-t border-stone-200 text-sm text-stone-500 flex items-center justify-between">
            <Link href="/" className="hover:text-stone-700">← First Light</Link>
            <p>Last updated May 2026</p>
          </footer>
        </article>
      </main>
    </>
  );
}
