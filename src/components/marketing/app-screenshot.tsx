"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Screenshot {
  id: string;
  label: string;
  caption: string;
  light: string;
  dark: string;
  width: number;
  height: number;
}

const screenshots: Screenshot[] = [
  {
    id: "today",
    label: "TODAY",
    caption: "The Daily Edition — an AI briefing shaped by your calendar, tasks, and patterns.",
    light: "/screenshots/app-today-light.png",
    dark: "/screenshots/app-today-dark.png",
    width: 1920,
    height: 1009,
  },
  {
    id: "sift",
    label: "THE SIFT",
    caption: "Drag tasks between quadrants to reprioritize by urgency × importance.",
    light: "/screenshots/app-sift.png",
    dark: "/screenshots/app-sift-dark.png",
    width: 1920,
    height: 1009,
  },
  {
    id: "quick-add",
    label: "QUICK ADD",
    caption: "Type or speak naturally — AI parses time, list, tags, and reminders.",
    light: "/screenshots/app-quick-add.png",
    dark: "/screenshots/app-quick-add-dark.png",
    width: 1920,
    height: 1009,
  },
  {
    id: "weekly-review",
    label: "WEEKLY REVIEW",
    caption: "Close last week. Pre-stage the next one.",
    light: "/screenshots/app-weekly-review-dark.png",
    dark: "/screenshots/app-weekly-review.png",
    width: 1920,
    height: 944,
  },
];

export function AppScreenshot() {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const shot = screenshots[index];
  const src = mode === "dark" ? shot.dark : shot.light;

  function prev() {
    setIndex((i) => (i === 0 ? screenshots.length - 1 : i - 1));
  }
  function next() {
    setIndex((i) => (i === screenshots.length - 1 ? 0 : i + 1));
  }

  return (
    <section className="py-12 max-w-6xl mx-auto w-full px-6">
      {/* Controls bar: left arrow — center block — right arrow */}
      <div className="flex items-center justify-center gap-4 mb-6">
        {/* Left arrow */}
        <button
          onClick={prev}
          aria-label="Previous screenshot"
          className="size-10 rounded-full border border-border dark:border-white/20 hover:bg-muted/60 dark:hover:bg-white/10 grid place-items-center transition-colors shrink-0"
        >
          <ChevronLeft className="size-5" />
        </button>

        {/* Center block: label + toggle + counter */}
        <div className="flex flex-col items-center gap-2">
          <p className="editorial-number text-[11px] tracking-[0.22em] text-muted-fg">
            {shot.label}
          </p>

          {/* Light/Dark toggle — centered, visible in both modes */}
          <div className="inline-flex items-center rounded-full border border-border dark:border-white/20 bg-muted/30 dark:bg-white/10 p-1 text-sm">
            <button
              onClick={() => setMode("light")}
              className={`px-4 py-1.5 rounded-full transition-all text-base ${
                mode === "light"
                  ? "bg-white dark:bg-white shadow-sm text-stone-900 font-medium"
                  : "text-muted-fg dark:text-white/60 hover:text-fg dark:hover:text-white/90"
              }`}
            >
              ☀️ Light
            </button>
            <button
              onClick={() => setMode("dark")}
              className={`px-4 py-1.5 rounded-full transition-all text-base ${
                mode === "dark"
                  ? "bg-stone-800 shadow-sm text-white font-medium"
                  : "text-muted-fg dark:text-white/60 hover:text-fg dark:hover:text-white/90"
              }`}
            >
              🌙 Dark
            </button>
          </div>

          <span className="text-xs text-muted-fg tabular-nums">
            {index + 1} / {screenshots.length}
          </span>
        </div>

        {/* Right arrow */}
        <button
          onClick={next}
          aria-label="Next screenshot"
          className="size-10 rounded-full border border-border dark:border-white/20 hover:bg-muted/60 dark:hover:bg-white/10 grid place-items-center transition-colors shrink-0"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      {/* Single centered screenshot */}
      <div className="relative rounded-2xl overflow-hidden border border-border shadow-2xl shadow-stone-200/50 dark:shadow-none dark:border-white/10">
        <Image
          src={src}
          alt={`First Light — ${shot.label}`}
          width={shot.width}
          height={shot.height}
          className="w-full h-auto"
          priority={index === 0}
        />
      </div>

      {/* Caption */}
      <p className="text-center text-sm text-muted-fg mt-4">
        {shot.caption}
      </p>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2.5 mt-4">
        {screenshots.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setIndex(i)}
            aria-label={`View ${s.label}`}
            className={`size-2.5 rounded-full transition-all ${
              i === index
                ? "bg-fg dark:bg-white scale-110"
                : "bg-border dark:bg-white/30 hover:bg-muted-fg dark:hover:bg-white/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
