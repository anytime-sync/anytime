"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { DemoCarousel } from "@/components/marketing/demo-carousel";
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
          <Link href="/" className="wordmark text-base">
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
                "Lists, Tags, Groups, Habits, Notes, Focus",
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
                $3<span className="text-sm text-muted-fg font-normal"> / month</span>
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

        <section className="mb-16">
          <DemoCarousel />
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
