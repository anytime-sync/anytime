"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { DemoCarousel } from "@/components/marketing/demo-carousel";
import { FeatureMatrix } from "@/components/app/feature-matrix";
import { useProPrice, usePlusPrice } from "@/hooks/use-pricing";
import { useStartCheckout } from "@/hooks/use-billing";
import { PLANS } from "@/lib/plans";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { t, readStoredLanguage, type LanguageCode } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

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
  const { data: pro, isLoading: priceLoading } = useProPrice();
  const { data: plus, isLoading: plusLoading } = usePlusPrice();
  const checkoutPlus = useStartCheckout("plus");
  const checkoutPro = useStartCheckout("pro");
  const [authState, setAuthState] = useState<"loading" | "out" | "in">("loading");
  const [lang, setLang] = useState<LanguageCode>("en");

  useEffect(() => {
    setLang(readStoredLanguage());
    const handler = (e: StorageEvent) => {
      if (e.key === "fl.language") setLang(readStoredLanguage());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => {
      setAuthState(data.user ? "in" : "out");
    });
  }, []);

  const proLabel = priceLoading
    ? t(lang, "pricing.plan.pro.name")
    : `${t(lang, "pricing.plan.pro.name")} - ${pro?.formattedPerMonth ?? "2026"}`;

  return (
    <div className="min-h-screen bg-bg">
      <MarketingNav lang={lang} onLangChange={setLang} activePage="pricing" />

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* Hero */}
        <section className="text-center max-w-2xl mx-auto mb-16">
          <p className="editorial-number text-[11px] mb-4">{t(lang, "pricing.kicker")}</p>
          <h1 className="font-display text-4xl md:text-5xl tracking-tight leading-tight mb-4">
            {t(lang, "pricing.hero.heading")}
          </h1>
          <p className="text-lg text-muted-fg leading-relaxed">
            {t(lang, "pricing.hero.body")}
          </p>
        </section>

        {/* Plan cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {/* Free */}
          <div className="border border-border rounded-2xl p-6 flex flex-col">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-display text-2xl tracking-tight">{t(lang, "pricing.plan.free.name")}</h2>
              <span className="text-2xl font-semibold">$0</span>
            </div>
            <p className="text-sm text-muted-fg mb-6">{PLANS[0].tagline}</p>
            <ul className="space-y-2 text-sm flex-1">
              {[
                "Today, Tomorrow, Next 7 / 90 days, Inbox",
                "Calendar with Google Calendar (read)",
                "Lists, Tags, Habits, Notes, Focus",
                "Daily Edition (1 / day)",
                "Email-to-inbox, push, daily digest",
                "Export your data, anytime",
                "Groups · free during beta",
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
                  {t(lang, "pricing.cta.openApp")} <ArrowRight className="size-4 ml-1" />
                </Link>
              ) : (
                <Link href="/signup" className="btn-ghost h-10 w-full justify-center">
                  {t(lang, "pricing.cta.startFree")} <ArrowRight className="size-4 ml-1" />
                </Link>
              )}
            </div>
          </div>

          {/* Plus — calendar + unlimited Daily Edition. Most-popular middle tier. */}
          <div className="border border-border rounded-2xl p-6 flex flex-col">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-display text-2xl tracking-tight">{t(lang, "pricing.plan.plus.name")}</h2>
              <span className="text-2xl font-semibold">
                {plusLoading ? "-" : plus?.formatted ?? "2026"}
                <span className="text-sm text-muted-fg font-normal">
                  {" "}/ {plus?.interval ?? "month"}
                </span>
              </span>
            </div>
            <p className="text-sm text-muted-fg mb-6">{PLANS[1].tagline}</p>
            <ul className="space-y-2 text-sm flex-1">
              {[
                "Everything in Free",
                "Unlimited Daily Edition",
                "Two-way Google Calendar sync",
                "Smart reschedule & Find time",
                "End-of-day Reflection",
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
                  onClick={() => checkoutPlus.mutate()}
                  disabled={checkoutPlus.isPending}
                  className="btn-primary h-10 w-full justify-center"
                >
                  {checkoutPlus.isPending ? t(lang, "pricing.cta.openingCheckout") : t(lang, "pricing.cta.upgradePlus")}{" "}
                  {!checkoutPlus.isPending && <ArrowRight className="size-4 ml-1" />}
                </button>
              ) : (
                <Link
                  href="/signup?next=/pricing&plan=plus"
                  className="btn-primary h-10 w-full justify-center"
                >
                  {t(lang, "pricing.cta.upgradePlus")} <ArrowRight className="size-4 ml-1" />
                </Link>
              )}
            </div>
          </div>

          {/* Pro */}
          <div className="border-2 border-accent rounded-2xl p-6 flex flex-col relative">
            <span className="absolute -top-3 left-6 bg-accent text-white text-[11px] px-2 py-0.5 rounded-full uppercase tracking-wide">
              {t(lang, "pricing.plan.pro.badge")}
            </span>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-display text-2xl tracking-tight flex items-center gap-2">
                {t(lang, "pricing.plan.pro.name")} <Sparkles className="size-5 text-accent" />
              </h2>
              <span className="text-2xl font-semibold">
                {priceLoading ? "-" : pro?.formatted ?? "2026"}
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
                  onClick={() => checkoutPro.mutate()}
                  disabled={checkoutPro.isPending}
                  className="btn-primary h-10 w-full justify-center"
                >
                  {checkoutPro.isPending ? t(lang, "pricing.cta.openingCheckout") : t(lang, "pricing.cta.upgradePro")}
                </button>
              ) : (
                <Link href="/signup?next=/pricing" className="btn-primary h-10 w-full justify-center">
                  {t(lang, "pricing.cta.startWithPro")} <ArrowRight className="size-4 ml-1" />
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="mb-16">
          <DemoCarousel lang={lang} />
        </section>

                {/* Full feature matrix */}
        <section className="mb-20">
          <h2 className="font-display text-3xl tracking-tight mb-2 text-center">{t(lang, "pricing.matrix.heading")}</h2>
          <p className="text-muted-fg text-center mb-10 max-w-xl mx-auto">
            {t(lang, "pricing.matrix.subheading")}
          </p>
          <FeatureMatrix />
        </section>

        {/* FAQ — expanded for SEO rich snippets */}
        <section className="max-w-2xl mx-auto mb-20">
          <h2 className="font-display text-3xl tracking-tight mb-6 text-center">{t(lang, "pricing.faq.heading")}</h2>
          <dl className="space-y-6 text-sm">
            {([
              ["pricing.faq.q1", "pricing.faq.a1"],
              ["pricing.faq.q2", "pricing.faq.a2"],
              ["pricing.faq.q3", "pricing.faq.a3"],
              ["pricing.faq.q4", "pricing.faq.a4"],
              ["pricing.faq.q5", "pricing.faq.a5"],
              ["pricing.faq.q6", "pricing.faq.a6"],
              ["pricing.faq.q7", "pricing.faq.a7"],
            ] as [Parameters<typeof t>[1], Parameters<typeof t>[1]][]).map(([qk, ak]) => (
              <div key={qk}>
                <dt className="font-medium mb-1">{t(lang, qk)}</dt>
                <dd className="text-muted-fg">{t(lang, ak)}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Final CTA */}
        <section className="text-center">
          {authState === "in" ? (
            <button
              onClick={() => checkoutPro.mutate()}
              disabled={checkoutPro.isPending}
              className="btn-primary h-11 px-6"
            >
              {checkoutPro.isPending ? t(lang, "pricing.cta.openingCheckout") : `${t(lang, "pricing.cta.upgradePro")} — ${pro?.formattedPerMonth ?? "2026"}`}
            </button>
          ) : (
            <Link href="/signup" className="btn-primary h-11 px-6">
              {t(lang, "pricing.final.ctaFree")}
            </Link>
          )}
          <p className="text-xs text-muted-fg mt-3">
            {t(lang, "pricing.final.note")}
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
