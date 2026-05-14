"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FeatureMatrix } from "@/components/app/feature-matrix";
import { useProPrice } from "@/hooks/use-pricing";
import { useStartCheckout } from "@/hooks/use-billing";
import { PLANS } from "@/lib/plans";

/**
 * Public /pricing one-pager.
 *
 * No auth required. Anyone hitting firstlight.to/pricing sees the same page;
 * the CTA changes based on whether they're signed in:
 *   - signed out → "Start free" + "Sign in"
 *   - signed in (free) → "Upgrade to Pro" routes through Stripe Checkout
 *   - signed in (pro)  → "Manage billing" routes to Stripe Portal (via app)
 */
export default function PricingPage() {
  const router = useRouter();
  const { data: pro, isLoading: priceLoading } = useProPrice();
  const checkout = useStartCheckout();
  const [authState, setAuthState] = useState<"loading" | "out" | "in">("loading");

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => {
      setAuthState(data.user ? "in" : "out");
    });
  }, []);

  const proLabel = priceLoading
    ? "Pro"
    : `Pro — ${pro?.formattedPerMonth ?? "$9 / month"}`;

  return (
    <div className="min-h-screen bg-bg">
      {/* Top bar */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-display text-xl tracking-tight">
            First Light
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/pricing" className="font-medium">Pricing</Link>
            {authState === "in" ? (
              <Link href="/app/today" className="btn-ghost h-8 px-3">Open app</Link>
            ) : (
              <>
                <Link href="/login" className="text-muted-fg hover:text-fg">Sign in</Link>
                <Link href="/signup" className="btn-primary h-8 px-3">Start free</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Hero */}
        <section className="text-center max-w-2xl mx-auto mb-16">
          <p className="editorial-number text-[11px] mb-4">PRICING</p>
          <h1 className="font-display text-4xl md:text-5xl tracking-tight leading-tight mb-4">
            Built for the way you actually plan.
          </h1>
          <p className="text-lg text-muted-fg leading-relaxed">
            Free covers the full task system, indefinitely. Plus unlocks
            two-way calendar and unlimited daily editions. Pro adds the full
            AI co-pilot — Plan my day, Voice → Task, and the review suite.
          </p>
        </section>

        {/* Plan cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {/* Free */}
          <div className="border border-border rounded-2xl p-6 flex flex-col">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-display text-2xl tracking-tight">Free</h2>
              <span className="text-2xl font-semibold">$0</span>
            </div>
            <p className="text-sm text-muted-fg mb-6">{PLANS[0].tagline}</p>
            <ul className="space-y-2 text-sm flex-1">
              {[
                "Today, Tomorrow, Next 7 / 90 days, Inbox",
                "Calendar with Google Calendar (read)",
                "Lists, Tags, Groups, Habits, Notes, Pomodoro",
                "Daily Edition (1 / day)",
                "Email-to-inbox, push, daily digest",
                "Export your data, anytime",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="size-4 text-accent mt-0.5 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {authState === "in" ? (
                <Link href="/app/today" className="btn-ghost h-10 w-full justify-center">
                  Open the app <ArrowRight className="size-4 ml-1" />
                </Link>
              ) : (
                <Link href="/signup" className="btn-ghost h-10 w-full justify-center">
                  Start free <ArrowRight className="size-4 ml-1" />
                </Link>
              )}
            </div>
          </div>

          {/* Plus — calendar + unlimited Daily Edition. Most-popular middle tier. */}
          <div className="border border-border rounded-2xl p-6 flex flex-col">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-display text-2xl tracking-tight">Plus</h2>
              <span className="text-2xl font-semibold">
                $4<span className="text-sm text-muted-fg font-normal"> / month</span>
              </span>
            </div>
            <p className="text-sm text-muted-fg mb-6">{PLANS[1].tagline}</p>
            <ul className="space-y-2 text-sm flex-1">
              {[
                "Everything in Free",
                "Unlimited Daily Edition",
                "Two-way Google Calendar sync",
                "End-of-day Reflection",
                "Drag-to-reschedule across views",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="size-4 text-accent mt-0.5 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {authState === "in" ? (
                <Link
                  href="/app/features"
                  className="btn-primary h-10 w-full justify-center"
                >
                  Upgrade to Plus <ArrowRight className="size-4 ml-1" />
                </Link>
              ) : (
                <Link
                  href="/signup?next=/pricing&plan=plus"
                  className="btn-primary h-10 w-full justify-center"
                >
                  Upgrade to Plus <ArrowRight className="size-4 ml-1" />
                </Link>
              )}
            </div>
          </div>

          {/* Pro */}
          <div className="border-2 border-accent rounded-2xl p-6 flex flex-col relative">
            <span className="absolute -top-3 left-6 bg-accent text-white text-[11px] px-2 py-0.5 rounded-full uppercase tracking-wide">
              Recommended
            </span>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-display text-2xl tracking-tight flex items-center gap-2">
                Pro <Sparkles className="size-5 text-accent" />
              </h2>
              <span className="text-2xl font-semibold">
                {priceLoading ? "—" : pro?.formatted ?? "$9"}
                <span className="text-sm text-muted-fg font-normal">
                  {" "}/ {pro?.interval ?? "month"}
                </span>
              </span>
            </div>
            <p className="text-sm text-muted-fg mb-6">{PLANS[2].tagline}</p>
            <ul className="space-y-2 text-sm flex-1">
              {[
                "Everything in Plus",
                "Plan-my-day & Plan-my-week",
                "Morning Co-pilot (conversational briefing)",
                "Voice → Task & Snapshot → Task",
                "Smart triage (AI Eisenhower)",
                "Weekly review + Goal tracker",
                "Semantic search across everything",
                "Priority support",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="size-4 text-accent mt-0.5 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {authState === "in" ? (
                <button
                  onClick={() => checkout.mutate()}
                  disabled={checkout.isPending}
                  className="btn-primary h-10 w-full justify-center"
                >
                  {checkout.isPending ? "Opening checkout…" : "Upgrade to Pro"}
                </button>
              ) : (
                <Link href="/signup?next=/pricing" className="btn-primary h-10 w-full justify-center">
                  Start with Pro <ArrowRight className="size-4 ml-1" />
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Demo strip — inline HTML mockups (no external screenshots needed). */}
        <section className="mb-20">
          <h2 className="font-display text-3xl tracking-tight mb-2 text-center">See it in motion</h2>
          <p className="text-muted-fg text-center mb-10 max-w-xl mx-auto">
            Three surfaces where First Light earns its $4 (and its $9). Real screens, not stock art.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* ── Mockup 1: Daily Edition ─────────────────────────────────── */}
            <figure className="border border-border rounded-2xl overflow-hidden bg-gradient-to-br from-amber-50/60 to-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2 relative">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">TUESDAY MORNING BRIEF</p>
                <p className="font-display text-base md:text-lg leading-tight text-stone-800">
                  An open day asks its own kind of question.
                </p>
                <div className="h-px bg-accent/40 w-10" />
                <p className="text-[11px] text-stone-600 leading-snug">
                  Nothing is scheduled. Nothing is due. That is either a gift or a gap — the distinction matters.
                </p>
                <div className="mt-auto bg-white border border-stone-200 rounded-md p-2.5 text-[10px] shadow-sm">
                  <p className="text-[7px] tracking-[0.2em] text-stone-400 mb-1">A QUESTION FOR YOU</p>
                  <p className="text-stone-700 leading-snug">Is this day genuinely free, or have the things that matter simply not been written down yet?</p>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Daily Edition</p>
                <p className="text-xs text-muted-fg">A morning briefing, never a to-do list.</p>
              </figcaption>
            </figure>

            {/* ── Mockup 2: Plan my day ──────────────────────────────────── */}
            <figure className="border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">ENERGY-AWARE SEQUENCING</p>
                <p className="font-display text-base md:text-lg text-stone-800 mb-1">Tuesday, mapped.</p>
                <div className="grid grid-cols-[24px_1fr] gap-x-2 gap-y-1.5 text-[10px] items-center">
                  <span className="text-stone-400 tabular-nums text-right">9</span>
                  <div className="rounded-md bg-accent/20 border-l-2 border-accent px-2 py-1 text-stone-800 font-medium">
                    Deep work · draft Q4 strategy
                  </div>
                  <span className="text-stone-400 tabular-nums text-right">11</span>
                  <div className="rounded-md bg-stone-200/70 border-l-2 border-stone-400 px-2 py-1 text-stone-700">
                    Standup
                  </div>
                  <span className="text-stone-400 tabular-nums text-right">1</span>
                  <div className="rounded-md bg-accent/15 border-l-2 border-accent/80 px-2 py-1 text-stone-700">
                    Review PR #142
                  </div>
                  <span className="text-stone-400 tabular-nums text-right">3</span>
                  <div className="rounded-md bg-stone-200/40 border-l-2 border-stone-300 px-2 py-1 text-stone-600">
                    Email batch
                  </div>
                  <span className="text-stone-400 tabular-nums text-right">5</span>
                  <div className="rounded-md bg-accent/10 border-l-2 border-accent/60 px-2 py-1 text-stone-600">
                    Reflection
                  </div>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Plan my day</p>
                <p className="text-xs text-muted-fg">AI sequences your day around your real energy.</p>
              </figcaption>
            </figure>

            {/* ── Mockup 3: Calendar ─────────────────────────────────────── */}
            <figure className="border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">WEEK OF MAY 12</p>
                  <p className="text-[9px] text-stone-400">8 items</p>
                </div>
                <div className="grid grid-cols-7 gap-1 text-[8px] text-stone-400 px-0.5">
                  {["M","T","W","T","F","S","S"].map((d, i) => (
                    <div key={i} className={"text-center " + (i===1 ? "text-accent font-semibold" : "")}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 flex-1">
                  <div className="bg-white border border-stone-200 rounded p-1 flex flex-col gap-0.5">
                    <div className="bg-accent/25 text-[7px] rounded px-1 truncate text-stone-800">Q4 doc</div>
                  </div>
                  <div className="bg-white border border-accent/50 rounded p-1 flex flex-col gap-0.5 ring-1 ring-accent/30">
                    <div className="bg-blue-100 text-[7px] rounded px-1 truncate text-blue-800">9 Standup</div>
                    <div className="bg-accent/25 text-[7px] rounded px-1 truncate text-stone-800">Review</div>
                    <div className="bg-stone-100 text-[7px] rounded px-1 truncate text-stone-600">+2</div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded p-1 flex flex-col gap-0.5">
                    <div className="bg-blue-100 text-[7px] rounded px-1 truncate text-blue-800">11 1:1</div>
                    <div className="bg-accent/20 text-[7px] rounded px-1 truncate text-stone-800">Reflect</div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded p-1 flex flex-col gap-0.5">
                    <div className="bg-accent/20 text-[7px] rounded px-1 truncate text-stone-800">Draft</div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded p-1 flex flex-col gap-0.5">
                    <div className="bg-blue-100 text-[7px] rounded px-1 truncate text-blue-800">3 Demo</div>
                    <div className="bg-accent/25 text-[7px] rounded px-1 truncate text-stone-800">Retro</div>
                  </div>
                  <div className="bg-white/60 border border-stone-200/60 rounded p-1" />
                  <div className="bg-white/60 border border-stone-200/60 rounded p-1" />
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Calendar</p>
                <p className="text-xs text-muted-fg">Tasks and Google events on the same grid.</p>
              </figcaption>
            </figure>
          </div>

          {/* Three more "moments" callout strip — copy that sells the upgrade */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-center">
            <div>
              <p className="editorial-number text-[9px] tracking-[0.22em] text-accent mb-1">MORNING</p>
              <p className="text-sm text-muted-fg leading-snug">A briefing you read once, not a backlog you scroll past.</p>
            </div>
            <div>
              <p className="editorial-number text-[9px] tracking-[0.22em] text-accent mb-1">MIDDAY</p>
              <p className="text-sm text-muted-fg leading-snug">Plan-my-day pre-arranges deep work around your peaks.</p>
            </div>
            <div>
              <p className="editorial-number text-[9px] tracking-[0.22em] text-accent mb-1">EVENING</p>
              <p className="text-sm text-muted-fg leading-snug">Reflect, learn one thing, close the day clean.</p>
            </div>
          </div>
        </section>

                {/* Full feature matrix */}
        <section className="mb-20">
          <h2 className="font-display text-3xl tracking-tight mb-2 text-center">Everything, side by side</h2>
          <p className="text-muted-fg text-center mb-10 max-w-xl mx-auto">
            The complete list of what's included in each plan.
          </p>
          <FeatureMatrix />
        </section>

        {/* FAQ short */}
        <section className="max-w-2xl mx-auto mb-20">
          <h2 className="font-display text-3xl tracking-tight mb-6 text-center">Common questions</h2>
          <dl className="space-y-6 text-sm">
            <div>
              <dt className="font-medium mb-1">Can I cancel anytime?</dt>
              <dd className="text-muted-fg">Yes. Use the customer portal in Settings → Billing. Your subscription stays active until the end of the period you've already paid for.</dd>
            </div>
            <div>
              <dt className="font-medium mb-1">What happens to my data if I downgrade?</dt>
              <dd className="text-muted-fg">Your data is yours. Tasks, notes, and calendar links keep working on Free; only the Pro-only AI features stop running.</dd>
            </div>
            <div>
              <dt className="font-medium mb-1">Is there a team plan?</dt>
              <dd className="text-muted-fg">Not yet. We're focused on making the single-player experience excellent first.</dd>
            </div>
          </dl>
        </section>

        {/* Final CTA */}
        <section className="text-center">
          {authState === "in" ? (
            <button
              onClick={() => checkout.mutate()}
              disabled={checkout.isPending}
              className="btn-primary h-11 px-6"
            >
              {checkout.isPending ? "Opening checkout…" : `Upgrade to ${proLabel}`}
            </button>
          ) : (
            <Link href="/signup" className="btn-primary h-11 px-6">
              Start free — no card needed
            </Link>
          )}
          <p className="text-xs text-muted-fg mt-3">
            Free forever for the core task system. Cancel Pro anytime.
          </p>
        </section>
      </main>

      <footer className="border-t border-border mt-16 py-6">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between text-xs text-muted-fg">
          <span>© First Light</span>
          <nav className="flex gap-4">
            <Link href="/privacy" className="hover:text-fg">Privacy</Link>
            <Link href="/terms" className="hover:text-fg">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
