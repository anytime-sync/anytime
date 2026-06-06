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
    light: "/screenshots/app-weekly-review.png",
    dark: "/screenshots/app-weekly-review-dark.png",
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
      {/* Header row: label + toggle + arrows */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <p className="editorial-number text-[10px] tracking-[0.22em] text-muted-fg">
          {shot.label}
        </p>

        <div className="flex items-center gap-3">
          {/* Light/Dark toggle */}
          <div className="inline-flex items-center rounded-full border border-border bg-muted/30 p-0.5 text-xs">
            <button
              onClick={() => setMode("light")}
              className={`px-2.5 py-1 rounded-full transition-all ${
                mode === "light"
                  ? "bg-white shadow-sm text-fg font-medium"
                  : "text-muted-fg hover:text-fg"
              }`}
            >
              ☀️
            </button>
            <button
              onClick={() => setMode("dark")}
              className={`px-2.5 py-1 rounded-full transition-all ${
                mode === "dark"
                  ? "bg-stone-800 shadow-sm text-white font-medium"
                  : "text-muted-fg hover:text-fg"
              }`}
            >
              🌙
            </button>
          </div>

          {/* Nav arrows */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={prev}
              aria-label="Previous screenshot"
              className="size-9 rounded-full border border-border hover:bg-muted/60 grid place-items-center transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs text-muted-fg tabular-nums min-w-[3ch] text-center">
              {index + 1}/{screenshots.length}
            </span>
            <button
              onClick={next}
              aria-label="Next screenshot"
              className="size-9 rounded-full border border-border hover:bg-muted/60 grid place-items-center transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Single centered screenshot */}
      <div className="relative rounded-2xl overflow-hidden border border-border shadow-2xl shadow-stone-200/50">
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
      <p className="text-center text-xs text-muted-fg mt-3">
        {shot.caption}
      </p>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {screenshots.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setIndex(i)}
            aria-label={`View ${s.label}`}
            className={`size-2 rounded-full transition-all ${
              i === index
                ? "bg-fg scale-110"
                : "bg-border hover:bg-muted-fg"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
