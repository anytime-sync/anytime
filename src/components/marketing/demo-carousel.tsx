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
                <div className="flex items-baseline justify-between gap-2">
                  <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">TUESDAY · OPEN DAY</p>
                  <p className="text-[8px] text-stone-400">May 13</p>
                </div>
                <p className="font-display text-base md:text-lg leading-tight text-stone-800">An open day asks its own kind of question.</p>
                <p className="text-[11px] text-stone-700 leading-snug">Nothing is scheduled. Nothing is due. The morning is yours to shape — start with the Q4 doc while the room is still quiet.</p>
                <p className="text-[10px] text-stone-600 leading-snug">Two windows of deep work fit cleanly before the 3pm review. Maya's note on cross-team framing is worth a second read first.</p>
                <p className="text-[10px] italic text-stone-500 border-t border-stone-200/70 pt-1.5 mt-auto leading-snug">Three of your last five wins started in mornings exactly like this one.</p>
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
                  <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">PLAN MY DAY · 4 ITEMS</p>
                </div>
                <p className="text-[10px] text-stone-700 italic leading-snug">Tackle the overdue doc first, then anchor both meetings before lunch. Afternoon protected for deep work.</p>
                <div className="space-y-1.5">
                  <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px]">
                    <p className="text-stone-800 font-medium truncate">Model SKP scenarios</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent/35 border border-accent/70 text-[8px] leading-none">
                        <span className="line-through opacity-70" style={{ color: "#8D6F2A" }}>Schedule</span>
                        <span style={{ color: "#8D6F2A" }}>→</span>
                        <span className="font-bold" style={{ color: "#5C4516" }}>Do first</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-[8px] text-stone-500 leading-none">High</span>
                    </div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px]">
                    <p className="text-stone-800 font-medium truncate">ASM review</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-[8px] text-stone-500 leading-none">Do first</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-[8px] text-stone-500 leading-none">High</span>
                    </div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px]">
                    <p className="text-stone-800 font-medium truncate">Reply to Maya</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent/35 border border-accent/70 text-[8px] leading-none">
                        <span className="line-through opacity-70" style={{ color: "#8D6F2A" }}>Do first</span>
                        <span style={{ color: "#8D6F2A" }}>→</span>
                        <span className="font-bold" style={{ color: "#5C4516" }}>Delegate</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-[8px] text-stone-500 leading-none">Low</span>
                    </div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px]">
                    <p className="text-stone-800 font-medium truncate">BC product reading</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-[8px] text-stone-500 leading-none">Schedule</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-[8px] text-stone-500 leading-none">Medium</span>
                    </div>
                  </div>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Plan my day</p>
                <p className="text-xs text-muted-fg">AI re-sorts today's work into the four quadrants — apply each, or all.</p>
              </figcaption>
            </figure>

            {/* 3 ── Morning Co-pilot: editorial brief with suggested actions */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-5 flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">CO-PILOT · TUESDAY</p>
                  <p className="text-[8px] text-stone-400">May 13</p>
                </div>
                <p className="font-display text-[13px] leading-tight text-stone-800">Three things you could let go of.</p>
                <p className="text-[10px] text-stone-700 leading-snug">Your morning is heavier than last week. A few items below could move or close cleanly.</p>
                <ul className="space-y-1 mt-0.5">
                  <li className="flex items-start gap-1.5 text-[9px] leading-snug">
                    <input type="checkbox" defaultChecked readOnly className="size-2.5 mt-0.5 accent-stone-700 shrink-0" />
                    <span className="text-[8px] tracking-wide uppercase text-stone-500 shrink-0">Defer</span>
                    <span className="text-stone-700 flex-1 min-w-0">3pm review fits Thursday better.</span>
                  </li>
                  <li className="flex items-start gap-1.5 text-[9px] leading-snug">
                    <input type="checkbox" defaultChecked readOnly className="size-2.5 mt-0.5 accent-stone-700 shrink-0" />
                    <span className="text-[8px] tracking-wide uppercase text-stone-500 shrink-0">Batch</span>
                    <span className="text-stone-700 flex-1 min-w-0">Two Slack replies can move together.</span>
                  </li>
                  <li className="flex items-start gap-1.5 text-[9px] leading-snug">
                    <input type="checkbox" readOnly className="size-2.5 mt-0.5 accent-stone-700 shrink-0" />
                    <span className="text-[8px] tracking-wide uppercase text-stone-500 shrink-0">Drop</span>
                    <span className="text-stone-700 flex-1 min-w-0">Inbox-zero ritual didn't earn its slot.</span>
                  </li>
                </ul>
                <p className="text-[9px] italic text-stone-500 border-t border-stone-200/70 pt-1.5 mt-auto leading-snug">Apply the two you agree with — I'll handle the moves.</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] px-2 py-0.5 rounded bg-stone-800 text-white">Apply</span>
                  <span className="text-[8px] px-2 py-0.5 text-stone-500">Snooze</span>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Morning Co-pilot</p>
                <p className="text-xs text-muted-fg">Proactive nudges with one-click apply — defer, drop, batch, reschedule.</p>
              </figcaption>
            </figure>

            {/* 4 ── The Sift: 2×2 Eisenhower quadrant grid */}
            <figure className="snap-start shrink-0 w-[280px] md:w-[calc((100%-32px)/3)] border border-border rounded-2xl overflow-hidden bg-stone-50 shadow-sm">
              <div className="aspect-[4/3] p-4 flex flex-col gap-2">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">THE SIFT · 4 QUADRANTS</p>
                <div className="grid grid-cols-2 gap-1.5 flex-1">
                  {/* Q1 Do first — red */}
                  <div className="rounded-md p-1.5 flex flex-col" style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.5)" }}>
                    <p className="text-[8px] font-medium" style={{ color: "#B91C1C" }}>Do first</p>
                    <p className="text-[7px] text-stone-400 leading-tight">Urgent · Important</p>
                    <div className="mt-1 bg-white border border-stone-200 rounded px-1.5 py-0.5 text-[8px] text-stone-700 truncate">Q4 doc by EOD</div>
                  </div>
                  {/* Q2 Schedule — emerald */}
                  <div className="rounded-md p-1.5 flex flex-col" style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.5)" }}>
                    <p className="text-[8px] font-medium" style={{ color: "#047857" }}>Schedule</p>
                    <p className="text-[7px] text-stone-400 leading-tight">Not urgent · Important</p>
                    <div className="mt-1 bg-white border border-stone-200 rounded px-1.5 py-0.5 text-[8px] text-stone-700 truncate">Model SKP scenarios</div>
                  </div>
                  {/* Q3 Delegate — amber */}
                  <div className="rounded-md p-1.5 flex flex-col" style={{ background: "rgba(245, 158, 11, 0.10)", border: "1px solid rgba(245, 158, 11, 0.55)" }}>
                    <p className="text-[8px] font-medium" style={{ color: "#B45309" }}>Delegate</p>
                    <p className="text-[7px] text-stone-400 leading-tight">Urgent · Not important</p>
                    <div className="mt-1 bg-white border border-stone-200 rounded px-1.5 py-0.5 text-[8px] text-stone-700 truncate">Reply to Maya</div>
                  </div>
                  {/* Q4 Eliminate — slate */}
                  <div className="rounded-md p-1.5 flex flex-col" style={{ background: "rgba(100, 116, 139, 0.08)", border: "1px solid rgba(148, 163, 184, 0.6)" }}>
                    <p className="text-[8px] font-medium" style={{ color: "#475569" }}>Eliminate</p>
                    <p className="text-[7px] text-stone-400 leading-tight">Not urgent · Not important</p>
                    <div className="mt-1 bg-white border border-stone-200 rounded px-1.5 py-0.5 text-[8px] text-stone-700 truncate">Inbox zero ritual</div>
                  </div>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">The Sift</p>
                <p className="text-xs text-muted-fg">AI sorts tasks into the 4 quadrants you can actually act on.</p>
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
              <div className="aspect-[4/3] p-5 flex flex-col gap-2">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">SAY IT · SHOOT IT</p>
                <div className="bg-white border border-stone-200 rounded-xl p-2.5 flex items-center gap-2">
                  <div className="h-7 px-2 inline-flex items-center gap-1 rounded-full bg-rose-500 text-white shrink-0">
                    <div className="size-2.5 rounded-full bg-white" />
                    <span className="flex items-end gap-[1.5px] h-3">
                      {[5,8,12,7,4].map((h, i) => (
                        <span key={i} className="w-[2px] bg-white rounded-full" style={{ height: h + "px" }} />
                      ))}
                    </span>
                  </div>
                  <p className="text-[10px] text-stone-700 italic truncate flex-1 min-w-0">“Draft Q4 strategy doc by Thursday 5pm”</p>
                </div>
                <div className="text-[9px] text-stone-400 text-center">↓ AI parses</div>
                <div className="bg-white border border-stone-200 rounded-md px-2 py-1.5 text-[10px] flex items-start gap-2">
                  <div className="size-3.5 rounded-full border-2 border-stone-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-stone-800 font-medium truncate">Draft Q4 strategy doc</p>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      <span className="text-[8px] italic text-stone-500">Thu · 5:00 PM</span>
                      <span className="text-[8px] italic text-stone-500">· High</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-auto pt-1">
                  <span className="text-[8px] tracking-[0.18em] text-stone-400">OR</span>
                  <span className="text-[9px] text-stone-600">Snapshot a whiteboard →</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">5 tasks</span>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Voice → Task · Snapshot → Task</p>
                <p className="text-xs text-muted-fg">Speak or photograph; AI extracts a task with the right date and priority.</p>
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
                  <div className="size-8 rounded-md bg-accent grid place-items-center text-[11px] font-semibold shrink-0">FL</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between">
                      <p className="text-white/60 text-[8px]">firstlight.to</p>
                      <p className="text-white/40 text-[7px]">now</p>
                    </div>
                    <p className="font-medium">Draft Q4 strategy doc</p>
                    <p className="text-white/70 text-[9px] truncate">First Light · Reminder</p>
                  </div>
                </div>
                <div className="bg-stone-900/85 text-white rounded-xl p-3 text-[10px] flex items-start gap-2 shadow-lg mt-2 ml-4 opacity-70">
                  <div className="size-8 rounded-md bg-accent grid place-items-center text-[11px] font-semibold shrink-0">FL</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between">
                      <p className="text-white/60 text-[8px]">firstlight.to</p>
                      <p className="text-white/40 text-[7px]">5m</p>
                    </div>
                    <p className="font-medium truncate">Review with Maya</p>
                    <p className="text-white/70 text-[9px] truncate">First Light · Reminder</p>
                  </div>
                </div>
              </div>
              <figcaption className="px-4 pt-3 pb-4 border-t border-stone-100 bg-white/40">
                <p className="font-medium text-sm">Push notifications</p>
                <p className="text-xs text-muted-fg">Per-task reminders — browser, PWA, mobile. Only when you ask for one.</p>
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
              <div className="aspect-[4/3] p-4 flex flex-col gap-1.5">
                <p className="editorial-number text-[8px] tracking-[0.22em] text-stone-500">PER-TASK · IF YOU SET ONE</p>
                <div className="rounded-md border border-stone-200 shadow-sm flex-1 flex flex-col p-3" style={{ background: "#FAF7F2" }}>
                  <p className="editorial-number text-[7px] tracking-[0.22em] text-stone-500">FIRST LIGHT · REMINDER</p>
                  <p className="font-display text-sm text-stone-800 leading-tight mt-1.5">Draft Q4 strategy doc</p>
                  <p className="text-[9px] text-stone-500 mt-1"><span className="text-stone-400">Due · </span>Thursday, May 15 · 17:00</p>
                  <div className="mt-auto pt-3">
                    <span className="inline-block text-[9px] text-white px-2.5 py-1 rounded" style={{ background: "#C89B5A" }}>Open in First Light →</span>
                  </div>
                  <p className="text-[7px] text-stone-400 mt-2 leading-snug border-t border-stone-200/70 pt-1.5">First Light · Reminder. <span className="underline">Unsubscribe</span></p>
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
