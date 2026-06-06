"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * AppScreenshot — hero screenshot with light/dark toggle,
 * then a 3-up row for Sift, Quick Add, and Weekly Review.
 */
export function AppScreenshot() {
  const [mode, setMode] = useState<"light" | "dark">("light");

  return (
    <section className="px-6 py-12 max-w-6xl mx-auto w-full">
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

      {/* Hero screenshot — Today view, full width */}
      <div className="relative rounded-2xl overflow-hidden border border-border shadow-2xl shadow-stone-200/50">
        <Image
          src={mode === "light" ? "/screenshots/app-today-light.png" : "/screenshots/app-today-dark.png"}
          alt="First Light — Today view with AI-generated Daily Edition briefing"
          width={1920}
          height={1009}
          className="w-full h-auto"
          priority
        />
      </div>
      <p className="text-center text-xs text-muted-fg mt-3">
        The Daily Edition — an AI briefing that reads your calendar, tasks, and patterns to shape your morning.
      </p>

      {/* 3-up row: Sift, Quick Add, Weekly Review */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* The Sift */}
        <div className="group">
          <p className="text-center text-[10px] editorial-number tracking-[0.22em] text-muted-fg mb-2">THE SIFT</p>
          <div className="relative rounded-xl overflow-hidden border border-border shadow-lg shadow-stone-200/30 transition-shadow group-hover:shadow-xl">
            <Image
              src="/screenshots/app-sift.png"
              alt="First Light — The Sift: Eisenhower Matrix for task prioritization"
              width={1920}
              height={1009}
              className="w-full h-auto"
            />
          </div>
          <p className="text-center text-xs text-muted-fg mt-2 leading-snug">
            Drag tasks between quadrants to reprioritize.
          </p>
        </div>

        {/* Quick Add */}
        <div className="group">
          <p className="text-center text-[10px] editorial-number tracking-[0.22em] text-muted-fg mb-2">QUICK ADD</p>
          <div className="relative rounded-xl overflow-hidden border border-border shadow-lg shadow-stone-200/30 transition-shadow group-hover:shadow-xl">
            <Image
              src="/screenshots/app-quick-add.png"
              alt="First Light — Quick Add: natural language task input with AI parsing"
              width={1920}
              height={1009}
              className="w-full h-auto"
            />
          </div>
          <p className="text-center text-xs text-muted-fg mt-2 leading-snug">
            Type or speak — AI parses time, tags, and priority.
          </p>
        </div>

        {/* Weekly Review */}
        <div className="group">
          <p className="text-center text-[10px] editorial-number tracking-[0.22em] text-muted-fg mb-2">WEEKLY REVIEW</p>
          <div className="relative rounded-xl overflow-hidden border border-border shadow-lg shadow-stone-200/30 transition-shadow group-hover:shadow-xl">
            <Image
              src="/screenshots/app-weekly-review.png"
              alt="First Light — Weekly Review with next-week preview"
              width={1920}
              height={944}
              className="w-full h-auto"
            />
          </div>
          <p className="text-center text-xs text-muted-fg mt-2 leading-snug">
            Close last week. Pre-stage the next one.
          </p>
        </div>
      </div>
    </section>
  );
}
