"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
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

  // Carousel state for the "See it in motion" demo strip. The scroll container
  // is the source of truth — we nudge it programmatically when arrows are
  // clicked and let scroll-snap handle the rest.
  const demosRef = useRef<HTMLDivElement>(null);
  function scrollDemos(direction: 1 | -1) {
    const el = demosRef.current;
    if (!el) return;
    // Scroll by one card width (3 cards visible on md+, 1 on mobile).
    const card = el.querySelector("figure") as HTMLElement | null;
    const step = (card?.offsetWidth ?? 280) + 16;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

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

        {/* Demo strip — 9-card carousel showcasing every Plus + Pro surface. */}
        <section className="mb-16">
          <div className="flex items-end justify-between mb-3 gap-4 flex-wrap">
            <div>
              <h2 className="font-display text-3xl tracking-tight">See it in motion</h2>
              <p className="text-muted-fg text-sm md:text-base max-w-xl mt-2">
                Nine surfaces where First Light earns its keep. Scroll, or use the arrows.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => scrollDemos(-1)}
                aria-label="Previous demos"
                className="size-10 rounded-full border border-border hover:bg-muted/60 grid place-items-center transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                onClick={() => scrollDemos(1)}
                aria-label="More demos"
                className="size-10 rounded-full border border-border hover:bg-muted/60 grid place-items-center transition-colors"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <div
            ref={demosRef}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 -mx-6 px-6 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >

            {/* 1 ── Daily Edition: the morning brief */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-gradient-to-br from-amber-50/60 to-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">TUESDAY MORNING BRIEF</p>
                <p className="font-display text-base md:text-lg leading-tight text-stone-800">An open day asks its own kind of question.</p>
                <div className="h-px bg-accent/40 w-10" />
                <p className="text-[11px] text-stone-600 leading-snug">Nothing is scheduled. Nothing is due. That is either a gift or a gap.</p>
                <div className="mt-auto bg-white border border-stone-200 rounded-md p-2.5 text-[10px] shadow-sm">
                  <p className="text-[7px] tracking-[0.2em] text-stone-400 mb-1">A QUESTION FOR YOU</p>
                  <p className="text-stone-700 leading-snug">Is this day genuinely free, or have the things that matter simply not been written down yet?</p>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Daily Edition</p>
                <p className="text-xs text-muted-fg">A morning briefing — never a to-do list.</p>
              </figcaption>
            </figure>

            {/* 2 ── Plan my day */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">ENERGY-AWARE SEQUENCING</p>
                <p className="font-display text-base md:text-lg text-stone-800 mb-1">Tuesday, mapped.</p>
                <div className="grid grid-cols-[24px_1fr] gap-x-2 gap-y-1.5 text-[10px] items-center">
                  <span className="text-stone-400 tabular-nums text-right">9</span>
                  <div className="rounded-md bg-accent/20 border-l-2 border-accent px-2 py-1 text-stone-800 font-medium">Deep work · draft Q4 strategy</div>
                  <span className="text-stone-400 tabular-nums text-right">11</span>
                  <div className="rounded-md bg-stone-200/70 border-l-2 border-stone-400 px-2 py-1 text-stone-700">Standup</div>
                  <span className="text-stone-400 tabular-nums text-right">1</span>
                  <div className="rounded-md bg-accent/15 border-l-2 border-accent/80 px-2 py-1 text-stone-700">Review PR #142</div>
                  <span className="text-stone-400 tabular-nums text-right">3</span>
                  <div className="rounded-md bg-stone-200/40 border-l-2 border-stone-300 px-2 py-1 text-stone-600">Email batch</div>
                  <span className="text-stone-400 tabular-nums text-right">5</span>
                  <div className="rounded-md bg-accent/10 border-l-2 border-accent/60 px-2 py-1 text-stone-600">Reflection</div>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Plan my day</p>
                <p className="text-xs text-muted-fg">AI sequences work around your real energy peaks.</p>
              </figcaption>
            </figure>

            {/* 3 ── Morning Co-pilot: conversational briefing */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2.5">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">CO-PILOT · 7:42 AM</p>
                <div className="flex gap-2 items-start">
                  <div className="size-6 rounded-full bg-accent/30 grid place-items-center shrink-0">
                    <span className="text-[9px] text-accent font-semibold">FL</span>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-sm px-3 py-2 text-[11px] text-stone-700 leading-snug">Your only fixed thing today is the 3pm review. Two open windows for deep work — 9–11 and 1–3. Want me to slot Q4 doc?</div>
                </div>
                <div className="bg-accent/20 rounded-2xl rounded-br-sm px-3 py-2 text-[11px] text-stone-800 ml-auto max-w-[80%]">Yes, and move the 4pm to tomorrow.</div>
                <div className="flex gap-2 items-start">
                  <div className="size-6 rounded-full bg-accent/30 grid place-items-center shrink-0">
                    <span className="text-[9px] text-accent font-semibold">FL</span>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-sm px-3 py-2 text-[11px] text-stone-700">Done. Your day is two long blocks and one short meeting.</div>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Morning Co-pilot</p>
                <p className="text-xs text-muted-fg">Talk to your day. It rearranges itself.</p>
              </figcaption>
            </figure>

            {/* 4 ── The Sift: AI triage */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">THE SIFT · BY AI</p>
                <p className="font-display text-base md:text-lg text-stone-800 mb-1">What actually needs you today.</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px]">
                    <span className="size-2 rounded-full bg-red-500 shrink-0" />
                    <span className="text-stone-700 truncate">Q4 doc — feedback by EOD</span>
                    <span className="ml-auto text-[8px] text-stone-400 shrink-0">U1·I1</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px]">
                    <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-stone-700 truncate">3pm review · prep notes</span>
                    <span className="ml-auto text-[8px] text-stone-400 shrink-0">U2·I1</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px]">
                    <span className="size-2 rounded-full bg-stone-400 shrink-0" />
                    <span className="text-stone-700 truncate">Reply to Maya · re: design</span>
                    <span className="ml-auto text-[8px] text-stone-400 shrink-0">U2·I2</span>
                  </div>
                </div>
                <p className="text-[10px] text-stone-500 italic mt-auto">+ 14 others — they can wait.</p>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">The Sift</p>
                <p className="text-xs text-muted-fg">AI separates the 3 that matter from the 17 that don't.</p>
              </figcaption>
            </figure>

            {/* 5 ── Calendar with two-way Google sync */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">WEEK OF MAY 12</p>
                  <span className="text-[8px] tracking-[0.18em] text-accent font-semibold">↔ G-CAL</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-[8px] text-stone-400 px-0.5">
                  {["M","T","W","T","F","S","S"].map((d, i) => (
                    <div key={i} className={"text-center " + (i===1 ? "text-accent font-semibold" : "")}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 flex-1">
                  <div className="bg-white border border-stone-200 rounded p-1"><div className="bg-accent/25 text-[7px] rounded px-1 truncate text-stone-800">Q4 doc</div></div>
                  <div className="bg-white border border-accent/50 rounded p-1 ring-1 ring-accent/30 space-y-0.5"><div className="bg-blue-100 text-[7px] rounded px-1 truncate text-blue-800">9 Standup</div><div className="bg-accent/25 text-[7px] rounded px-1 truncate text-stone-800">Review</div><div className="bg-stone-100 text-[7px] rounded px-1 text-stone-600">+2</div></div>
                  <div className="bg-white border border-stone-200 rounded p-1 space-y-0.5"><div className="bg-blue-100 text-[7px] rounded px-1 truncate text-blue-800">11 1:1</div><div className="bg-accent/20 text-[7px] rounded px-1 truncate text-stone-800">Reflect</div></div>
                  <div className="bg-white border border-stone-200 rounded p-1"><div className="bg-accent/20 text-[7px] rounded px-1 truncate text-stone-800">Draft</div></div>
                  <div className="bg-white border border-stone-200 rounded p-1 space-y-0.5"><div className="bg-blue-100 text-[7px] rounded px-1 truncate text-blue-800">3 Demo</div><div className="bg-accent/25 text-[7px] rounded px-1 truncate text-stone-800">Retro</div></div>
                  <div className="bg-white/60 border border-stone-200/60 rounded p-1" />
                  <div className="bg-white/60 border border-stone-200/60 rounded p-1" />
                </div>
                <p className="text-[9px] text-stone-500 italic">Drag a task → it creates a GCal event. Drag a GCal event → it reschedules.</p>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Two-way Google Calendar</p>
                <p className="text-xs text-muted-fg">Tasks and events on one grid; edits sync both ways.</p>
              </figcaption>
            </figure>

            {/* 6 ── Share Groups */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">DESIGN TEAM</p>
                  <div className="flex -space-x-1.5">
                    <div className="size-5 rounded-full bg-accent/40 border border-white grid place-items-center text-[8px] text-accent font-semibold">A</div>
                    <div className="size-5 rounded-full bg-blue-200 border border-white grid place-items-center text-[8px] text-blue-700 font-semibold">B</div>
                    <div className="size-5 rounded-full bg-emerald-200 border border-white grid place-items-center text-[8px] text-emerald-700 font-semibold">M</div>
                    <div className="size-5 rounded-full bg-stone-200 border border-white grid place-items-center text-[8px] text-stone-600 font-semibold">+1</div>
                  </div>
                </div>
                <p className="font-display text-base text-stone-800 mb-1">Shared, not noisy.</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px]">
                    <div className="size-4 rounded-full bg-accent/40 grid place-items-center text-[8px] text-accent font-semibold">A</div>
                    <span className="text-stone-700 truncate">Ship Figma export</span>
                    <span className="ml-auto text-[8px] text-stone-400">Today</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px]">
                    <div className="size-4 rounded-full bg-blue-200 grid place-items-center text-[8px] text-blue-700 font-semibold">B</div>
                    <span className="text-stone-700 truncate">Draft case study</span>
                    <span className="ml-auto text-[8px] text-stone-400">Wed</span>
                  </div>
                  <div className="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-md px-2 py-1.5 text-[10px]">
                    <div className="size-4 rounded-full bg-emerald-200 grid place-items-center text-[8px] text-emerald-700 font-semibold">Y</div>
                    <span className="text-stone-800 font-medium truncate">Review brand copy</span>
                    <span className="ml-auto text-[8px] text-stone-400">Today</span>
                  </div>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Share Groups</p>
                <p className="text-xs text-muted-fg">A workspace per team — without becoming a Slack.</p>
              </figcaption>
            </figure>

            {/* 7 ── Voice → Task & Snapshot → Task */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2.5">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">SAY IT · SHOOT IT</p>
                <p className="font-display text-base text-stone-800">Capture without typing.</p>
                <div className="bg-white border border-stone-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="size-9 rounded-full bg-accent/20 grid place-items-center shrink-0">
                    <div className="size-4 rounded-full bg-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-0.5 h-3 mb-0.5">
                      {[3,5,8,12,9,6,4,7,10,8,5,3,7,9,4].map((h, i) => (
                        <div key={i} className="w-0.5 bg-accent/60 rounded-full" style={{ height: h + "px" }} />
                      ))}
                    </div>
                    <p className="text-[10px] text-stone-600 italic truncate">"Reschedule team sync to Thursday 3pm"</p>
                  </div>
                </div>
                <div className="text-[9px] text-stone-400 text-center">↓</div>
                <div className="bg-accent/10 border border-accent/40 rounded-md px-2 py-1.5 text-[10px]">
                  <p className="text-stone-800 font-medium">Team sync</p>
                  <p className="text-stone-500 text-[9px]">Thu · 3:00 PM · GCal event</p>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Voice → Task</p>
                <p className="text-xs text-muted-fg">Speak or photograph; we extract the structure.</p>
              </figcaption>
            </figure>


            {/* 8 ── Notes → Task: convert note to task in one click */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">NOTE · STRATEGY SESSION</p>
                <div className="bg-white border border-stone-200 rounded-md p-2.5 text-[10px] text-stone-700 leading-snug flex-1">
                  Discussed Q4 priorities with Maya. Key decision: ship the export feature before holidays.
                  <span className="block mt-1.5 text-stone-400">[[ship-export]]</span>
                </div>
                <div className="text-[9px] text-stone-400 text-center">↓ one click</div>
                <div className="bg-accent/10 border border-accent/40 rounded-md px-2 py-1.5 text-[10px] flex items-center gap-2">
                  <input type="checkbox" className="size-3" readOnly />
                  <span className="text-stone-800 font-medium truncate">Ship export feature</span>
                  <span className="ml-auto text-[8px] text-stone-400">linked</span>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Notes → Task</p>
                <p className="text-xs text-muted-fg">Any note becomes a linked task. Edit either side; both update.</p>
              </figcaption>
            </figure>

            {/* 9 ── Goal tracker: outcome-shaped goals with AI sub-trackers */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">GOAL · Q4</p>
                <p className="font-display text-base text-stone-800 leading-tight">Ship v2 by Aug 31.</p>
                <div className="space-y-1.5 text-[10px]">
                  <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5 flex items-center gap-2">
                    <span className="text-stone-700 flex-1 truncate">Export feature</span>
                    <div className="h-1.5 w-12 bg-stone-200 rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: "78%" }} /></div>
                    <span className="text-stone-500 text-[8px]">78%</span>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5 flex items-center gap-2">
                    <span className="text-stone-700 flex-1 truncate">Onboarding</span>
                    <div className="h-1.5 w-12 bg-stone-200 rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: "45%" }} /></div>
                    <span className="text-stone-500 text-[8px]">45%</span>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5 flex items-center gap-2">
                    <span className="text-stone-700 flex-1 truncate">Pricing page</span>
                    <div className="h-1.5 w-12 bg-stone-200 rounded-full overflow-hidden"><div className="h-full bg-accent" style={{ width: "100%" }} /></div>
                    <span className="text-stone-500 text-[8px]">✓</span>
                  </div>
                </div>
                <p className="text-[9px] text-stone-500 italic mt-auto">AI checks in every Friday.</p>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Goal tracker</p>
                <p className="text-xs text-muted-fg">Outcomes, not checklists. AI designs the sub-trackers.</p>
              </figcaption>
            </figure>

            {/* 10 ── Weekly Review + Next Week Preview */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-gradient-to-br from-stone-50 to-amber-50/40 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">FRIDAY · WEEKLY REVIEW</p>
                <p className="font-display text-base text-stone-800 leading-tight">Look back, then forward.</p>
                <div className="bg-white border border-stone-200 rounded-md p-2 text-[10px]">
                  <p className="text-[7px] tracking-[0.2em] text-stone-400 mb-1">LAST WEEK</p>
                  <p className="text-stone-700 leading-snug">14 done · 3 carried · best morning Tue.</p>
                </div>
                <div className="bg-accent/10 border border-accent/30 rounded-md p-2 text-[10px]">
                  <p className="text-[7px] tracking-[0.2em] text-stone-500 mb-1">NEXT WEEK · PREVIEW</p>
                  <p className="text-stone-700 leading-snug">3 deep-work blocks pre-staged. Mon 10am, Wed 9am, Thu 1pm.</p>
                </div>
                <p className="text-[9px] text-stone-500 italic mt-auto">A Friday-style retro that actually surfaces patterns.</p>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Weekly Review + Next-week Preview</p>
                <p className="text-xs text-muted-fg">Close last week. Pre-stage the next one.</p>
              </figcaption>
            </figure>

            {/* 11 ── Semantic search */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">SEARCH · BY MEANING</p>
                <div className="bg-white border border-stone-200 rounded-md px-2.5 py-2 text-[10px] flex items-center gap-2">
                  <span className="text-stone-400">⌕</span>
                  <span className="text-stone-700">things i decided about Q4 pricing</span>
                </div>
                <p className="text-[8px] tracking-[0.2em] text-stone-400 mt-1">3 RESULTS</p>
                <div className="space-y-1.5 text-[10px]">
                  <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5">
                    <p className="text-stone-700 truncate">Note · Strategy session</p>
                    <p className="text-stone-400 text-[8px] truncate">"...$4 tier between free and pro..."</p>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5">
                    <p className="text-stone-700 truncate">Task · Draft pricing page</p>
                    <p className="text-stone-400 text-[8px] truncate">Done · Tuesday</p>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5">
                    <p className="text-stone-700 truncate">Reflection · Apr 18</p>
                    <p className="text-stone-400 text-[8px] truncate">"...Plus tier worth testing..."</p>
                  </div>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Semantic search</p>
                <p className="text-xs text-muted-fg">Find by meaning across tasks, notes, comments — no keyword gymnastics.</p>
              </figcaption>
            </figure>

            {/* 12 ── Push notifications */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-gradient-to-br from-stone-100 to-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2 justify-center">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500 mb-2">PUSH · BROWSER + PWA</p>
                <div className="bg-stone-900/95 text-white rounded-xl p-3 text-[10px] flex items-start gap-2 shadow-lg">
                  <div className="size-8 rounded-md bg-accent grid place-items-center text-[11px] font-semibold">FL</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between">
                      <p className="text-white/60 text-[8px]">First Light</p>
                      <p className="text-white/40 text-[7px]">now</p>
                    </div>
                    <p className="font-medium">Deep-work window opens in 10 min.</p>
                    <p className="text-white/70 text-[9px] truncate">Q4 doc is queued — start at 9.</p>
                  </div>
                </div>
                <div className="bg-stone-900/85 text-white rounded-xl p-3 text-[10px] flex items-start gap-2 shadow-lg mt-2 ml-4 opacity-70">
                  <div className="size-8 rounded-md bg-accent grid place-items-center text-[11px] font-semibold">FL</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/60 text-[8px]">First Light · 5m ago</p>
                    <p className="truncate">3pm review starts in 15 min.</p>
                  </div>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Push notifications</p>
                <p className="text-xs text-muted-fg">Quiet nudges — browser, PWA, mobile. Never spammy.</p>
              </figcaption>
            </figure>

            {/* 13 ── Email digest */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-4 flex flex-col gap-1.5">
                <div className="bg-white border border-stone-200 rounded-md p-3 shadow-sm flex-1 flex flex-col">
                  <p className="editorial-number text-[7px] tracking-[0.22em] text-accent">FIRST LIGHT · DAILY DIGEST</p>
                  <p className="font-display text-sm text-stone-800 leading-tight mt-1.5">Aaron, here's your day.</p>
                  <p className="text-[8px] text-stone-400 mt-0.5">Wednesday, May 13</p>
                  <p className="text-[9px] tracking-[0.2em] text-stone-500 mt-2.5">URGENT + IMPORTANT</p>
                  <p className="text-[10px] text-stone-700 leading-snug">Q4 doc — feedback by EOD.</p>
                  <p className="text-[9px] tracking-[0.2em] text-stone-500 mt-2">ON THE AGENDA</p>
                  <p className="text-[10px] text-stone-700 truncate">3pm — Review with Maya</p>
                  <div className="mt-auto bg-accent rounded-md text-white text-[9px] px-2 py-1 text-center font-medium">Open today in First Light</div>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Email digest</p>
                <p className="text-xs text-muted-fg">Your day, in your inbox at 6am. Read it once, then close it.</p>
              </figcaption>
            </figure>

            {/* 14 ── Email reminders */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">PER-TASK · IF YOU SET ONE</p>
                <div className="bg-white border border-stone-200 rounded-md p-2.5 text-[10px] shadow-sm flex-1">
                  <div className="flex items-center gap-2 pb-2 border-b border-stone-100">
                    <div className="size-6 rounded-md bg-accent/30 grid place-items-center text-[9px] text-accent font-semibold">FL</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] text-stone-400">First Light · noreply@firstlight.to</p>
                      <p className="font-medium truncate text-stone-800">Reminder: Q4 strategy doc — 5pm</p>
                    </div>
                  </div>
                  <p className="text-stone-700 mt-2 leading-snug">Due at 5:00 PM today. The doc is open at firstlight.to/app/today.</p>
                  <p className="text-[8px] text-stone-400 mt-2">Snooze · Done · Manage reminders</p>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Email reminders</p>
                <p className="text-xs text-muted-fg">For the tasks you really can't forget — set once, arrives on time.</p>
              </figcaption>
            </figure>

            {/* 15 ── Reflection (standalone, evening) */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-gradient-to-br from-stone-50 to-amber-50/40 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">END OF DAY · REFLECTION</p>
                <p className="font-display text-base md:text-lg text-stone-800 leading-tight">What surprised you?</p>
                <div className="bg-white border border-stone-200 rounded-md p-2.5 text-[10px] text-stone-700 leading-snug">
                  Maya's feedback unlocked the Q4 framing. Worth keeping cross-team review on the calendar next week.
                </div>
                <div className="bg-accent/10 border border-accent/30 rounded-md p-2.5 mt-auto">
                  <p className="text-[7px] tracking-[0.2em] text-stone-500 mb-1">AI · CONNECTED THE DOTS</p>
                  <p className="text-[10px] text-stone-700 leading-snug">Three of your last five wins came from cross-team conversations.</p>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Reflection</p>
                <p className="text-xs text-muted-fg">One prompt at sunset. AI notices what you wouldn't.</p>
              </figcaption>
            </figure>

            {/* 16 ── Priority support */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2.5">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">SUPPORT · PRO ONLY</p>
                <p className="font-display text-base text-stone-800 leading-tight">A real human, fast.</p>
                <div className="flex gap-2 items-start">
                  <div className="size-6 rounded-full bg-emerald-200 grid place-items-center text-[8px] text-emerald-700 font-semibold shrink-0">Y</div>
                  <div className="bg-accent/10 rounded-2xl rounded-tl-sm px-2.5 py-1.5 text-[10px] text-stone-700">Quick one — can I move my Plus to annual?</div>
                </div>
                <div className="flex gap-2 items-start">
                  <div className="size-6 rounded-full bg-accent/30 grid place-items-center text-[8px] text-accent font-semibold shrink-0">FL</div>
                  <div className="bg-white border border-stone-200 rounded-2xl rounded-tl-sm px-2.5 py-1.5 text-[10px] text-stone-700 leading-snug">Yes — done. 8 min reply. Anything else?</div>
                </div>
                <div className="mt-auto text-[9px] text-stone-500 italic flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Avg reply time today: 14 minutes.
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Priority support</p>
                <p className="text-xs text-muted-fg">Pro questions get answered within one business day. Often faster.</p>
              </figcaption>
            </figure>
          </div>

          {/* Three-moment callout strip */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-center">
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
