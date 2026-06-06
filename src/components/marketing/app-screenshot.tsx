"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Screenshot {
  id: string;
  label: string;
  caption: string;
  light: string;
  dark: string | null;
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
    dark: null,
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

function ScreenshotCard({ shot }: { shot: Screenshot }) {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const hasDark = shot.dark !== null;
  const src = mode === "dark" && hasDark ? shot.dark! : shot.light;

  return (
    <div className="snap-center shrink-0 w-[85vw] max-w-[900px] flex flex-col">
      {/* Per-card light/dark toggle */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] editorial-number tracking-[0.22em] text-muted-fg">
          {shot.label}
        </p>
        {hasDark && (
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
        )}
      </div>

      {/* Screenshot image */}
      <div className="relative rounded-2xl overflow-hidden border border-border shadow-2xl shadow-stone-200/50">
        <Image
          src={src}
          alt={`First Light — ${shot.label}`}
          width={shot.width}
          height={shot.height}
          className="w-full h-auto"
          priority={shot.id === "today"}
        />
      </div>

      <p className="text-center text-xs text-muted-fg mt-3 leading-snug">
        {shot.caption}
      </p>
    </div>
  );
}

export function AppScreenshot() {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(direction: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector("[class*='snap-center']") as HTMLElement | null;
    const step = (card?.offsetWidth ?? 800) + 20;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  return (
    <section className="py-12 w-full">
      {/* Header with scroll arrows */}
      <div className="max-w-6xl mx-auto px-6 flex items-end justify-between mb-6">
        <div>
          <p className="editorial-number text-xs text-muted-fg mb-1">SEE THE APP</p>
          <h2 className="font-display text-2xl md:text-3xl tracking-tight">
            Built for how your day actually works.
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => scroll(-1)}
            aria-label="Previous screenshot"
            className="size-10 rounded-full border border-border hover:bg-muted/60 grid place-items-center transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => scroll(1)}
            aria-label="Next screenshot"
            className="size-10 rounded-full border border-border hover:bg-muted/60 grid place-items-center transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Scrollable gallery */}
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 px-[calc((100vw-900px)/2)] [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {screenshots.map((shot) => (
          <ScreenshotCard key={shot.id} shot={shot} />
        ))}
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {screenshots.map((shot) => (
          <div
            key={shot.id}
            className="size-1.5 rounded-full bg-border"
          />
        ))}
      </div>
    </section>
  );
}
