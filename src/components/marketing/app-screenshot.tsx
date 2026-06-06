"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * AppScreenshot — hero screenshot showcase with light/dark toggle.
 * Shows real screenshots: Daily Edition, The Sift, Quick Add, and Weekly Review.
 */
export function AppScreenshot() {
  const [mode, setMode] = useState<"light" | "dark">("light");

  return (
    <section className="px-6 py-12 max-w-5xl mx-auto w-full">
      {/* Light/Dark toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center rounded-full border border-border bg-muted/30 p-0.5 text-sm">
          <button
            onClick={() => setMode("light")}
            className={`px-4 py-1.5 rounded-full transition-all ${
              mode === "light"
                ? "bg-white shadow-sm text-fg font-medium"
                : "text-muted-fg hover:text-fg"
            }`}
          >
            ☀️ Light
          </button>
          <button
            onClick={() => setMode("dark")}
            className={`px-4 py-1.5 rounded-full transition-all ${
              mode === "dark"
                ? "bg-stone-800 shadow-sm text-white font-medium"
                : "text-muted-fg hover:text-fg"
            }`}
          >
            🌙 Dark
          </button>
        </div>
      </div>

      {/* Main screenshot — Daily Edition / Today view */}
      <div className="relative rounded-2xl overflow-hidden border border-border shadow-2xl shadow-stone-200/50">
        <Image
          src={mode === "light" ? "/screenshots/app-today-light.png" : "/screenshots/app-today-dark.png"}
          alt="First Light — Today's Agenda with Saturday Brief cards showing AI-generated daily briefings"
          width={1440}
          height={900}
          className="w-full h-auto"
          priority
        />
      </div>
      <p className="text-center text-xs text-muted-fg mt-3">
        The Daily Edition — an AI briefing that reads your calendar, tasks, and patterns to shape your morning.
      </p>

      {/* The Sift — Eisenhower Matrix */}
      <div className="mt-10">
        <p className="text-center text-xs editorial-number tracking-[0.22em] text-muted-fg mb-4">THE SIFT</p>
        <div className="relative rounded-2xl overflow-hidden border border-border shadow-xl shadow-stone-200/40">
          <Image
            src="/screenshots/app-sift.png"
            alt="First Light — The Sift: Eisenhower Matrix view sorting tasks by urgency and importance"
            width={1440}
            height={900}
            className="w-full h-auto"
          />
        </div>
        <p className="text-center text-xs text-muted-fg mt-3">
          The Sift — drag tasks between quadrants to instantly re-prioritize by urgency × importance.
        </p>
      </div>

      {/* Quick Add modal */}
      <div className="mt-10">
        <p className="text-center text-xs editorial-number tracking-[0.22em] text-muted-fg mb-4">QUICK ADD</p>
        <div className="relative rounded-2xl overflow-hidden border border-border shadow-xl shadow-stone-200/40">
          <Image
            src="/screenshots/app-quick-add.png"
            alt="First Light — Quick Add: type or speak a task and AI parses time, tags, priority, and reminders"
            width={1440}
            height={900}
            className="w-full h-auto"
          />
        </div>
        <p className="text-center text-xs text-muted-fg mt-3">
          Quick Add — type or speak naturally. AI parses the time, list, tags, and reminders for you.
        </p>
      </div>

      {/* Weekly Review screenshot */}
      <div className="mt-10">
        <p className="text-center text-xs editorial-number tracking-[0.22em] text-muted-fg mb-4">WEEKLY REVIEW</p>
        <div className="relative rounded-2xl overflow-hidden border border-border shadow-xl shadow-stone-200/40">
          <Image
            src="/screenshots/app-weekly-review.png"
            alt="First Light — Weekly Review showing next week's pre-staged schedule and shipped items"
            width={1440}
            height={900}
            className="w-full h-auto"
          />
        </div>
        <p className="text-center text-xs text-muted-fg mt-3">
          Weekly Review — AI pre-stages next week&apos;s focus windows from your calendar and task history.
        </p>
      </div>
    </section>
  );
}
