"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { FeatureMatrix } from "@/components/app/feature-matrix";
import { useUserPlan, useStartCheckout, useOpenBillingPortal } from "@/hooks/use-billing";
import { useProPrice, usePlusPrice } from "@/hooks/use-pricing";
import { DemoCarousel } from "@/components/marketing/demo-carousel";
import { t, readStoredLanguage, type LanguageCode } from "@/lib/i18n";

/**
 * In-app /app/features page.
 *
 * Same Free vs Pro matrix as /pricing, but auth-gated and aware of the user's
 * current plan. Pro users see "Manage billing"; Free users see "Upgrade".
 */
export default function FeaturesPage() {
  const { data: plan } = useUserPlan();
  const { data: pro, isLoading: priceLoading } = useProPrice();
  const { data: plus, isLoading: plusLoading } = usePlusPrice();
  const checkoutPlus = useStartCheckout("plus");
  const checkoutPro = useStartCheckout("pro");
  const portal = useOpenBillingPortal();
  const [lang, setLang] = useState<LanguageCode>("en");

  useEffect(() => {
    setLang(readStoredLanguage());
    const handler = (e: StorageEvent) => {
      if (e.key === "fl.language") setLang(readStoredLanguage());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Treat plus + pro + vip as "paid" for surfaces that just need to swap
  // Upgrade → Manage billing. The plan label still shows the precise tier.
  const isPlus = plan?.plan === "plus";
  const isPro = plan?.plan === "pro" || plan?.plan === "vip";
  const isPaid = isPlus || isPro;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-6 h-24 md:h-28 border-b border-border flex flex-col justify-center">
        <h1 className="font-display text-3xl md:text-4xl tracking-tight leading-tight">
          {t(lang, "features.heading")}
        </h1>
        <p className="text-sm text-muted-fg mt-1">
          {t(lang, "features.subheading")}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-3xl space-y-10">
          {/* Current plan badge + CTA */}
          <section className="border border-border rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="editorial-number text-[11px] mb-1">{t(lang, "features.yourPlan")}</p>
              <p className="font-display text-2xl tracking-tight flex items-center gap-2">
                {isPro ? (
                  <>{t(lang, "features.plan.pro")} <Sparkles className="size-5 text-accent" /></>
                ) : isPlus ? (
                  <>{t(lang, "features.plan.plus")} <Sparkles className="size-5 text-accent/70" /></>
                ) : (
                  t(lang, "features.plan.free")
                )}
              </p>
              {isPaid ? (
                plan?.cancelAtPeriodEnd ? (
                  <p className="text-xs text-muted-fg mt-1">
                    {t(lang, "features.cancels")}
                    {plan.currentPeriodEnd
                      ? ` (${new Date(plan.currentPeriodEnd).toLocaleDateString()})`
                      : null}
                    .
                  </p>
                ) : (
                  <p className="text-xs text-muted-fg mt-1">
                    {t(lang, "features.renews")}
                    {plan.currentPeriodEnd
                      ? ` ${new Date(plan.currentPeriodEnd).toLocaleDateString()}`
                      : null}
                    .
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-fg mt-1">
                  {t(lang, "features.freeTip")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isPro ? (
                <button
                  onClick={() => portal.mutate()}
                  disabled={portal.isPending}
                  className="btn-ghost h-10 px-4"
                >
                  {portal.isPending ? t(lang, "features.openingPortal") : t(lang, "features.manageBilling")}
                </button>
              ) : isPlus ? (
                <>
                  <button
                    onClick={() => checkoutPro.mutate()}
                    disabled={checkoutPro.isPending}
                    className="btn-primary h-10 px-4"
                  >
                    {checkoutPro.isPending
                      ? t(lang, "features.redirecting")
                      : priceLoading
                      ? t(lang, "features.upgradePro")
                      : `${t(lang, "features.upgradePro")} — ${pro?.formatted ?? "2026"}`}
                  </button>
                  <button
                    onClick={() => portal.mutate()}
                    disabled={portal.isPending}
                    className="btn-ghost h-10 px-4"
                  >
                    {portal.isPending ? t(lang, "features.openingPortal") : t(lang, "features.manageBilling")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => checkoutPlus.mutate()}
                    disabled={checkoutPlus.isPending}
                    className="btn-primary h-10 px-4 inline-flex items-center opacity-90"
                  >
                    {checkoutPlus.isPending
                      ? t(lang, "features.redirecting")
                      : plusLoading
                      ? t(lang, "features.upgradePlus")
                      : `${t(lang, "features.upgradePlus")} — ${plus?.formattedPerMonth ?? "2026"}`}
                  </button>
                  <button
                    onClick={() => checkoutPro.mutate()}
                    disabled={checkoutPro.isPending}
                    className="btn-primary h-10 px-4"
                  >
                    {checkoutPro.isPending
                      ? t(lang, "features.redirecting")
                      : priceLoading
                      ? t(lang, "features.upgradePro")
                      : `${t(lang, "features.upgradePro")} — ${pro?.formatted ?? "2026"}`}
                  </button>
                </>
              )}
            </div>
          </section>

          {/* What's new in Pro (only for Free users) */}
          {!isPaid ? (
            <section className="border border-accent/40 bg-accent/5 rounded-2xl p-5">
              <p className="editorial-number text-[11px] mb-3">{t(lang, "features.unlockHeading")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {[
                  { title: "Daily Edition", body: "Unlimited briefings; today, not just one a day." },
                  { title: "Plan my day", body: "AI sequences your day around energy peaks and capacity." },
                  { title: "Plan my week", body: "Weekly plan that respects deadlines and goals." },
                  { title: "Morning Co-pilot", body: "Conversational briefing that answers follow-ups." },
                  { title: "Reflection", body: "End-of-day reflection with AI-assisted prompts." },
                  { title: "Two-way GCal", body: "Quick-add creates Google Calendar events." },
                ].map((it) => (
                  <div key={it.title}>
                    <p className="font-medium">{it.title}</p>
                    <p className="text-muted-fg mt-0.5">{it.body}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Visual demo — same carousel as /pricing */}
          <section>
            <DemoCarousel lang={lang} />
          </section>

          {/* Full matrix */}
          <section>
            <h2 className="font-display text-2xl tracking-tight mb-2">{t(lang, "features.matrixHeading")}</h2>
            <p className="text-sm text-muted-fg mb-6">
              {isPro
                ? t(lang, "features.matrixSubPro")
                : isPlus
                  ? t(lang, "features.matrixSubPlus")
                  : t(lang, "features.matrixSubFree")}
            </p>
            <FeatureMatrix currentPlan={(plan?.plan as any) ?? "free"} />
          </section>

          {/* Footer link to public pricing for sharing */}
          <section className="border-t border-border pt-6 text-sm text-muted-fg">
            {t(lang, "features.shareLink")}{" "}
            <Link href="/pricing" className="text-accent hover:underline inline-flex items-center gap-1">
              {t(lang, "features.publicPricing")} <ArrowRight className="size-3.5" />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
