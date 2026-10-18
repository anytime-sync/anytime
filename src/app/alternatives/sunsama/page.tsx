import Link from "next/link";
import { loadPrices, formatPrice } from "@/lib/pricing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "First Light vs Sunsama — compare the workflow",
  description: "Both products support daily planning. Decide whether you want a guided planning workflow or First Light’s task views with optional AI assistance.",
  alternates: { canonical: "/alternatives/sunsama" },
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
    dateModified: "2026-10-18",
    author: { "@type": "Organization", "name": "First Light" },
    publisher: {
      "@type": "Organization",
      name: "First Light",
      logo: { "@type": "ImageObject", url: "https://firstlight.to/icons/icon.svg" },
    },
    mainEntityOfPage: "https://firstlight.to/alternatives/sunsama",
  };
  const rows: [string, string, string][] = [
  [
    "Primary workflow",
    "Guided daily planning and timeboxing",
    "Personal task views and optional AI"
  ],
  [
    "Planning approach",
    "Review the current Sunsama workflow",
    "Review priorities; apply chosen changes"
  ],
  [
    "Calendar",
    "See supported calendar integrations",
    "Google read on Free; editing on Plus/Pro"
  ],
  [
    "Price",
    "See official pricing",
    "Free, Plus and Pro"
  ]
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
            <p className="editorial-number text-[10px] tracking-[0.22em] text-amber-700">COMPARISON · UPDATED OCTOBER 18, 2026</p>
            <h1 className="font-display text-4xl md:text-5xl leading-tight tracking-tight">First Light vs Sunsama</h1>
            <p className="text-stone-600 text-lg leading-relaxed">Both products support daily planning. Decide whether you want a guided planning workflow or First Light’s task views with optional AI assistance.</p>
            <p className="text-sm text-stone-600">Written by First Light. This is a product-fit guide, not an independent performance test.</p>
          </div>
          <section className="rounded-2xl border border-stone-200 bg-white/60 p-6 space-y-3">
            <h2 className="font-display text-2xl">When to consider Sunsama</h2>
            <p className="leading-relaxed">Sunsama presents a guided daily planning workflow with timeboxing and connected work tools. Consider it if that structure matches how you plan. Try the workflow with actual commitments rather than assuming that a longer feature list makes another planner better.</p>
            <p className="text-sm"><a className="underline" href="https://www.sunsama.com">Official Sunsama product information</a></p>
          </section>
          <section className="space-y-4">
            <h2 className="font-display text-2xl md:text-3xl">When to consider First Light</h2>
            <p className="leading-relaxed text-stone-700">Choose First Light if its Today, Inbox and upcoming views help you capture commitments and return to the next action. Notes, habits, a focus timer and an urgency/importance matrix support that personal workflow.</p>
            <ul className="space-y-3 ml-6 list-disc text-stone-700">
              <li><strong>Optional briefing.</strong> Request Brief me for source-linked suggestions based on recorded tasks and calendar events. It does not change your tasks.</li>
              <li><strong>Planning on Pro.</strong> Plan my day and Plan my week suggest priorities and urgency/importance quadrants. Review and apply changes; these tools do not automatically fill your calendar.</li>
              <li><strong>Capture on Pro.</strong> Use supported voice or image input, then check extracted details before saving.</li>
              <li><strong>Google Calendar.</strong> Connect to read events on Free. Creating and editing Google events requires Plus or Pro.</li>
              <li><strong>Reviews and connections.</strong> Pro includes weekly reviews, goal steps, semantic search and API/MCP access. Connections need setup and AI usage limits apply.</li>
            </ul>
          </section>
          <section className="space-y-4">
            <h2 className="font-display text-2xl md:text-3xl">Side by side</h2>
            <div className="overflow-x-auto -mx-6 px-6"><table className="w-full text-sm border-collapse">
              <thead><tr className="border-b border-stone-300"><th className="text-left py-3 pr-4">Area</th><th className="text-left py-3 px-4">Sunsama</th><th className="text-left py-3 px-4">First Light</th></tr></thead>
              <tbody className="text-stone-700">{rows.map(([area, other, firstlight]) => <tr key={area} className="border-b border-stone-200"><td className="py-3 pr-4">{area}</td><td className="py-3 px-4">{other}</td><td className="py-3 px-4">{firstlight}</td></tr>)}</tbody>
            </table></div>
          </section>
          <section className="space-y-4">
            <h2 className="font-display text-2xl md:text-3xl">Know the limits before switching</h2>
            <p className="leading-relaxed text-stone-700">First Light is a web/PWA product. Saving, syncing and AI need internet access. Shared Groups are in beta, and an AI suggestion is not proof of an edited task or booked calendar event. Check source records and saved changes.</p>
            <p className="leading-relaxed text-stone-700">Try a few real commitments before migrating. If you use both products, decide where each task and deadline is maintained; this page does not promise automatic synchronization between them.</p>
          </section>
          <section className="space-y-4">
            <h2 className="font-display text-2xl md:text-3xl">First Light plans</h2>
            <ul className="space-y-2 ml-6 list-disc text-stone-700">
              <li><strong>Free:</strong> core task planner, calendar reading and optional AI briefing with daily usage limits.</li>
              <li><strong>Plus ({plusFmt}/mo):</strong> two-way Google Calendar, rescheduling suggestions, Find time and reflection.</li>
              <li><strong>Pro ({proFmt}/mo):</strong> Plus features, AI planning, voice/image capture, weekly reviews, goal steps, semantic search and API/MCP.</li>
            </ul>
            <p className="text-sm text-stone-600">See <Link className="underline" href="/pricing">the current feature table</Link> and checkout terms. AI usage limits apply to every plan. Check Sunsama&apos;s official site for its current prices.</p>
          </section>
          <section className="rounded-2xl bg-amber-50/60 border border-amber-200 p-8 text-center space-y-4">
            <h2 className="font-display text-3xl">Try a real task.</h2>
            <p className="text-stone-700">Start free, capture a commitment, and see whether the workflow fits.</p>
            <Link href="/signup" className="inline-flex items-center justify-center h-11 px-5 rounded-md bg-stone-900 text-white font-medium hover:bg-stone-800">Start free</Link>
          </section>
          <footer className="pt-8 border-t border-stone-200 text-sm text-stone-500"><Link href="/">← First Light</Link></footer>
        </article>
      </main>
    </>
  );
}
