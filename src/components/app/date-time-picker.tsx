"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserPrefs } from "@/hooks/use-ai";
import { getLanguage } from "@/lib/i18n";

/**
 * DateTimePicker — calm, editorial replacement for the native
 * <input type="datetime-local"> picker. Designed to match First Light's
 * aesthetic: warm accent (no bright blue), tabular-nums, soft borders,
 * locale-aware formatting.
 *
 * Trigger button reads like a regular input field, and clicking it pops
 * a 280-px panel below with:
 *   - Month grid (Mon–Sun, prev/next month)
 *   - Compact 12-hour time row: HH : MM + AM/PM toggle
 *   - Today / Tomorrow / Clear chips
 *
 * Returns ISO strings via onChange; null when cleared.
 */

type Props = {
  value: string | null; // ISO
  onChange: (iso: string | null) => void;
  placeholder?: string;
  className?: string;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function to12h(h24: number): { h12: number; meridiem: "AM" | "PM" } {
  const meridiem = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { h12, meridiem };
}

function from12h(h12: number, meridiem: "AM" | "PM"): number {
  if (meridiem === "AM") return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick date & time",
  className,
}: Props) {
  const { data: prefs } = useUserPrefs();
  const locale = getLanguage(prefs?.language).dateFnsLocale;
  const meridiemLabels = useMemo(() => {
    // Render the meridiem labels in the active locale so a zh-TW user sees
    // 上午/下午, an English user sees AM/PM, etc.
    const sample = new Date();
    sample.setHours(9, 0, 0, 0);
    const am = format(sample, "a", { locale });
    sample.setHours(15, 0, 0, 0);
    const pm = format(sample, "a", { locale });
    return { AM: am, PM: pm };
  }, [locale]);

  const current = value ? new Date(value) : null;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // The popover keeps its own draft date/time so editing time fields
  // doesn't fire a write per keystroke. We commit on selection / blur.
  const [viewMonth, setViewMonth] = useState<Date>(() => current ?? new Date());
  const initial12 = to12h(current?.getHours() ?? 9);
  const [h12, setH12] = useState<number>(initial12.h12);
  const [mm, setMm] = useState<number>(current?.getMinutes() ?? 0);
  const [meridiem, setMeridiem] = useState<"AM" | "PM">(initial12.meridiem);

  // Re-sync local state when external value changes (e.g. parent reset).
  useEffect(() => {
    if (!value) return;
    const d = new Date(value);
    const t = to12h(d.getHours());
    setH12(t.h12);
    setMeridiem(t.meridiem);
    setMm(d.getMinutes());
    setViewMonth(d);
  }, [value]);

  // Click-outside to dismiss.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (popoverRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function commit(day: Date, hours12 = h12, minutes = mm, mer = meridiem) {
    const h24 = from12h(hours12, mer);
    const d = new Date(day);
    d.setHours(h24, minutes, 0, 0);
    onChange(d.toISOString());
  }

  function selectDay(day: Date) {
    commit(day);
  }

  function changeTime(nextH12: number, nextMm: number, nextMer: "AM" | "PM") {
    setH12(nextH12);
    setMm(nextMm);
    setMeridiem(nextMer);
    if (current) commit(current, nextH12, nextMm, nextMer);
  }

  function pickToday() {
    const t = new Date();
    setViewMonth(t);
    commit(t);
  }

  function pickTomorrow() {
    const t = addDays(new Date(), 1);
    setViewMonth(t);
    commit(t);
  }

  function clear() {
    onChange(null);
    setOpen(false);
  }

  // Build the visible 6-row month grid (Mon-anchored).
  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  // Trigger label — locale-formatted full date + time, or placeholder.
  const triggerLabel = current
    ? format(current, "PPP p", { locale })
    : placeholder;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "input w-full text-left flex items-center justify-between gap-2",
          !current && "text-muted-fg"
        )}
      >
        <span className="truncate">{triggerLabel}</span>
        <CalendarIcon className="size-4 text-muted-fg shrink-0" />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className={cn(
            "absolute top-[calc(100%+6px)] left-0 z-50",
            "surface border border-border rounded-lg shadow-xl",
            "p-3 w-[300px]"
          )}
          role="dialog"
        >
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewMonth(addMonths(viewMonth, -1))}
              className="btn-ghost size-7 grid place-items-center rounded-md"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="font-display text-sm tabular-nums">
              {format(viewMonth, "MMMM yyyy", { locale })}
            </p>
            <button
              type="button"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              className="btn-ghost size-7 grid place-items-center rounded-md"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 gap-0.5 text-[10px] text-muted-fg uppercase tracking-wider mb-1">
            {Array.from({ length: 7 }, (_, i) => addDays(gridStart, i)).map(
              (d) => (
                <div key={d.toISOString()} className="text-center py-1">
                  {format(d, "EEEEE", { locale })}
                </div>
              )
            )}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d) => {
              const sel = current ? isSameDay(d, current) : false;
              const today = isSameDay(d, new Date());
              const inMonth = isSameMonth(d, viewMonth);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => selectDay(d)}
                  className={cn(
                    "size-9 rounded-md text-xs tabular-nums transition-colors",
                    sel
                      ? "bg-accent text-bg font-medium"
                      : "hover:bg-muted",
                    !inMonth && "text-muted-fg/40",
                    today && !sel && "ring-1 ring-accent/50"
                  )}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>

          {/* Time row */}
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="editorial-number text-[10px] uppercase shrink-0">
                Time
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={h12}
                  onChange={(e) => {
                    const n = clamp(parseInt(e.target.value, 10) || 1, 1, 12);
                    changeTime(n, mm, meridiem);
                  }}
                  className="input w-12 text-center tabular-nums"
                  aria-label="Hour"
                />
                <span className="text-muted-fg">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={String(mm).padStart(2, "0")}
                  onChange={(e) => {
                    const n = clamp(parseInt(e.target.value, 10) || 0, 0, 59);
                    changeTime(h12, n, meridiem);
                  }}
                  className="input w-12 text-center tabular-nums"
                  aria-label="Minute"
                />
              </div>
              {/* AM / PM toggle — locale-rendered (上午/下午 in zh-TW). */}
              <div className="ml-auto inline-flex rounded-md border border-border overflow-hidden text-xs shrink-0">
                {(["AM", "PM"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => changeTime(h12, mm, m)}
                    className={cn(
                      "px-2.5 h-7 whitespace-nowrap",
                      meridiem === m
                        ? "bg-fg text-bg"
                        : "btn-ghost rounded-none"
                    )}
                  >
                    {meridiemLabels[m]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick presets + done */}
          <div className="mt-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={pickToday}
                className="btn-ghost px-2 h-7"
              >
                Today
              </button>
              <button
                type="button"
                onClick={pickTomorrow}
                className="btn-ghost px-2 h-7"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={clear}
                className="btn-ghost px-2 h-7 text-muted-fg"
              >
                Clear
              </button>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-ghost px-2 h-7"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
