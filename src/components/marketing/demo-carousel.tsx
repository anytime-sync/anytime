"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * DemoCarousel — the 16-card "See it in motion" strip shared by /pricing
 * and the public landing page. Pure presentation: every card is an inline
 * HTML/Tailwind mockup that mirrors a real feature surface in the app.
 *
 * Behaviour: horizontal scroll-snap with arrow buttons that nudge the row
 * by one card width. The viewport shows 3 cards on md+ and 1 on mobile.
 */
export function DemoCarousel() {
  const demosRef = useRef<HTMLDivElement>(null);
  function scrollDemos(direction: 1 | -1) {
    const el = demosRef.current;
    if (!el) return;
    const card = el.querySelector("figure") as HTMLElement | null;
    const step = (card?.offsetWidth ?? 280) + 16;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  return (
    <>
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
                <div className="flex items-baseline justify-between">
                  <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">TODAY · 4 ITEMS</p>
                  <p className="text-[8px] text-stone-400">AI · ROUND 1</p>
                </div>
                <p className="text-[11px] text-stone-700 italic leading-snug">Tackle the overdue model first, then anchor both p0 meetings before lunch — afternoon reserved for product work.</p>
                <div className="space-y-1.5">
                  <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px]">
                    <p className="text-stone-800 font-medium truncate">Model SKP scenarios</p>
                    <p className="text-stone-500 text-[8px]">Q1 · p5 · Overdue 3 days — blocks downstream decisions.</p>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px]">
                    <p className="text-stone-800 font-medium truncate">ASM Meeting</p>
                    <p className="text-stone-500 text-[8px]">Q1 · p5 · Anchor the morning — fixed calendar slot.</p>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px]">
                    <p className="text-stone-800 font-medium truncate">Camillia Meeting</p>
                    <p className="text-stone-500 text-[8px]">Q2 · p3 · High-signal — schedule after ASM.</p>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px]">
                    <p className="text-stone-800 font-medium truncate">BC product RL</p>
                    <p className="text-stone-500 text-[8px]">Q2 · p3 · Deep work — fits afternoon if meetings land.</p>
                  </div>
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
                    <span className="ml-auto text-[8px] text-stone-400 shrink-0">Urgent</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px]">
                    <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-stone-700 truncate">3pm review · prep notes</span>
                    <span className="ml-auto text-[8px] text-stone-400 shrink-0">Important</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px]">
                    <span className="size-2 rounded-full bg-stone-400 shrink-0" />
                    <span className="text-stone-700 truncate">Reply to Maya · re: design</span>
                    <span className="ml-auto text-[8px] text-stone-400 shrink-0">Later</span>
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

            {/* 16 ── Priority support: real human, fast email replies */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-2">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">SUPPORT · PRO ONLY</p>
                <div className="bg-white border border-stone-200 rounded-md shadow-sm flex-1 flex flex-col text-[10px]">
                  <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-stone-100">
                    <div className="size-5 rounded-md bg-accent/30 grid place-items-center text-[8px] text-accent font-semibold">FL</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-stone-800 font-medium truncate">Re: Move my Plus to annual</p>
                      <p className="text-[8px] text-stone-400">First Light support · 8 min ago</p>
                    </div>
                  </div>
                  <div className="px-2.5 py-2 text-stone-700 leading-snug border-b border-stone-100">
                    Done — switched you to the annual plan. Pro-rated credit applied to your next renewal.
                  </div>
                  <div className="px-2.5 py-1.5 text-stone-500 flex items-center justify-between text-[9px]">
                    <span>Reply · Forward</span>
                    <span className="text-stone-400">support@firstlight.to</span>
                  </div>
                </div>
                <div className="text-[9px] text-stone-500 italic flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Replies within one business day. Often faster.
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Priority support</p>
                <p className="text-xs text-muted-fg">Real human, real fast — straight to your inbox.</p>
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

        
    </>
  );
}
