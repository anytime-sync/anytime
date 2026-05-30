"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseQuickInput, describeParsed, describeNow, type ParsedQuickInput } from "@/lib/quick-parse";
import { useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { useCreateProject, useProjects } from "@/hooks/use-projects";
import { useTags } from "@/hooks/use-tags";
import { useUIStore } from "@/store/ui";
import { useParseTaskAI } from "@/hooks/use-ai";
import { VoiceButton } from "./voice-button";
import {
  Bell, CalendarClock, CalendarPlus, Flag, Folder, Hash, Repeat, Sparkles, ChevronDown,
  ScanLine,
} from "lucide-react";
import { ScanTasksSheet } from "./scan-tasks-sheet";
import { toast } from "sonner";
import { addDays, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { t as tr } from "@/lib/i18n";

/** Natural-language triggers that auto-flip Quick Add into Event mode.
 *  Conservative on purpose: only unambiguous calendar-y words.
 *  Case-insensitive, matched as whole words. Stripped from title before submit. */
const EVENT_TRIGGER_RE =
  /\b(google(?:\s+calendar)?|gcal|gmeet|calendar event)\b/i;

const EXAMPLES = [
  "Email Sam tomorrow at 9am with a reminder 30 minutes before, urgent #work",
  "Stand-up every weekday at 10am",
  "Pick up groceries on Friday at 6pm in Errands #shopping",
  "Pay rent monthly on the 1st",
  "Call mom Sunday afternoon",
];


/** For each attribute kind, regexes that recognise an existing phrase
 *  of that type in the input. injectPhrase() strips matching ranges
 *  before adding the new phrase, so clicking Today → Tomorrow swaps
 *  the date instead of stacking 'today tomorrow'. Tags are intentionally
 *  excluded — those are a multi-value list. */
const STRIP_PATTERNS: Record<
  "time" | "repeat" | "reminder" | "priority" | "inbox",
  RegExp[]
> = {
  time: [
    /\b(today|tonight|tomorrow)\b/gi,
    /\b(next|this) +(week|month|year|mon(day)?|tue(s|sday)?|wed(nesday)?|thu(r|rs|rsday)?|fri(day)?|sat(urday)?|sun(day)?)\b/gi,
    /\bin +\d+ +(day|days|week|weeks|month|months)\b/gi,
    /\bon +\d{4}-\d{2}-\d{2}(?:[ T]\d{1,2}:\d{2})?\b/gi,
    /\bat +\d{1,2}:\d{2}\b/gi,
    /\b\d{1,2}(?::\d{2})? *(am|pm|AM|PM)\b/g,
  ],
  repeat: [
    /\bevery +(day|weekday|week|month|year|mon(day)?|tue(s|sday)?|wed(nesday)?|thu(r|rs|rsday)?|fri(day)?|sat(urday)?|sun(day)?)\b/gi,
    /\b(daily|weekly|monthly|yearly|annually)\b/gi,
  ],
  reminder: [
    /\bremind +me +\d+ *(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days) +before\b/gi,
  ],
  priority: [
    /\b(urgent|asap|high +priority|important|medium +priority|low +priority|no +priority)\b/gi,
  ],
  inbox: [
    /(^|\s)~[\p{L}\p{N}_-]+\b/gu,
  ],
};

function stripExisting(text: string, kind: keyof typeof STRIP_PATTERNS): string {
  let out = text;
  for (const re of STRIP_PATTERNS[kind]) out = out.replace(re, " ");
  // Collapse whitespace introduced by the stripping.
  return out.replace(/ {2,}/g, " ").replace(/ +([,;.])/g, "$1").trim();
}

export function QuickAdd() {
  const lang = useLanguage();
  const open = useUIStore((s) => s.quickAddOpen);
  const setOpen = useUIStore((s) => s.setQuickAddOpen);
  const [text, setText] = useState("");
  const [now, setNow] = useState(() => new Date());
  const inputRef = useRef<HTMLInputElement>(null);
  // Which chip's options panel is currently revealed (null = none).
  const [activeChip, setActiveChip] = useState<
    "time" | "repeat" | "reminder" | "priority" | "inbox" | "tags" | null
  >(null);
  // "Scan tasks" sheet — opens from the camera button next to the input.
  // The sheet handles the camera/upload, AI extraction, preview, and
  // bulk-create itself; we just need to know when it succeeds so we can
  // close QuickAdd as well (consistent with the single-task submit flow).
  const [scanOpen, setScanOpen] = useState(false);
  // When ON, Quick Add submit creates a Google Calendar event instead of a task.
  const [eventMode, setEventMode] = useState(false);
  // Tracks whether the user manually clicked the Event pill. When set
  // (true or false), the text-driven auto-toggle stops overwriting them,
  const [scanFile, setScanFile] = useState<File | null>(null);
  // so they keep control until the modal closes.
  const manualOverrideRef = useRef<boolean | null>(null);

  // Auto-flip to Event mode when the input contains a calendar trigger.
  // We never auto-turn-OFF on text change — user must click the pill
  // to revert, so deleting the word does not silently swap modes mid-typing.
  useEffect(() => {
    if (manualOverrideRef.current !== null) return; // user chose manually
    setEventMode(EVENT_TRIGGER_RE.test(text));
  }, [text]);

  /** Inject (or replace) an attribute phrase into the input.
   *
   *  If `kind` is supplied, any existing phrase of that kind is removed
   *  first — so picking Today then Tomorrow swaps the date instead of
   *  stacking "today tomorrow". When kind is null/undefined the phrase
   *  is just appended (used for raw '#' tag insertion).
   *
   *  Inserts at the cursor when the input is focused; otherwise appends
   *  at the end. Always re-focuses afterward. */
  function injectPhrase(
    phrase: string,
    kind?: keyof typeof STRIP_PATTERNS | null
  ) {
    const sep = (cur: string) => (cur && !cur.endsWith(" ") ? " " : "");
    if (kind) {
      // Replace mode: strip prior attribute then append the new phrase.
      const stripped = stripExisting(text, kind);
      const next = stripped + sep(stripped) + phrase;
      setText(next);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        try { el.setSelectionRange(next.length, next.length); } catch {}
      });
      setActiveChip(null);
      return;
    }
    // Append mode (tags, free-form '#'): use cursor if focused.
    const el = inputRef.current;
    if (el && document.activeElement === el) {
      const start = el.selectionStart ?? text.length;
      const end = el.selectionEnd ?? text.length;
      const before = text.slice(0, start);
      const after = text.slice(end);
      const insert = sep(before) + phrase + (after && !after.startsWith(" ") ? " " : "");
      const next = before + insert + after;
      setText(next);
      requestAnimationFrame(() => {
        const pos = (before + insert).length;
        el.focus();
        try { el.setSelectionRange(pos, pos); } catch {}
      });
    } else {
      setText((t) => t + sep(t) + phrase);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    setActiveChip(null);
  }
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const createProject = useCreateProject();
  const { data: projects = [] } = useProjects();
  // Tag color lookup so parsed #tag pills match the sidebar pill style.
  const { data: existingTags = [] } = useTags();
  const aiParse = useParseTaskAI();

  // Admin-curated priority phrases (`site_priority_keywords`) that
  // extend the parser's built-in list. Loaded once when the panel
  // opens; cached in React state so re-typing doesn't re-fetch.
  const [extraPhrases, setExtraPhrases] = useState<
    Array<{ phrase: string; priority: 0 | 1 | 3 | 5 }>
  >([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const locale =
          (typeof navigator !== "undefined" && navigator.language) || "en";
        // Try the user's full BCP-47 first (e.g. zh-TW), fall back to
        // the primary subtag (zh) if there's no rows for the locale.
        const candidates = [locale, locale.split("-")[0] ?? "en", "en"];
        for (const c of candidates) {
          const res = await fetch(
            `/api/keywords/active?locale=${encodeURIComponent(c)}`
          );
          if (!res.ok) continue;
          const j = await res.json().catch(() => ({}));
          const phrases = (j.phrases ?? []) as Array<{
            phrase: string;
            priority: 0 | 1 | 3 | 5;
          }>;
          if (phrases.length) {
            if (!cancelled) setExtraPhrases(phrases);
            return;
          }
        }
        if (!cancelled) setExtraPhrases([]);
      } catch {
        if (!cancelled) setExtraPhrases([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Auto-detect the user's existing tags + projects whenever they're
  // mentioned in plain prose. Same context the inline input uses.
  const parseCtx = useMemo(
    () => ({
      existingTags: existingTags.map((t: any) => t.name),
      existingProjects: projects.map((p: any) => p.name),
      extraPhrases,
    }),
    [existingTags, projects, extraPhrases]
  );
  const parsed = useMemo(() => parseQuickInput(text, parseCtx), [text, parseCtx]);
  const preview = useMemo(() => describeParsed(parsed, now), [parsed, now]);
  const quadrant = useMemo(() => classifyQuadrant(parsed, now), [parsed, now]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (open) {
      setText("");
      setNow(new Date());
      setEventMode(false);
      manualOverrideRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if (!open && e.key.toLowerCase() === "q" && !isTyping(e)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  /**
   * Quick-add submit — instant feel, AI refinement in the background.
   *
   * Flow:
   *   1. Close the modal synchronously so the user is back to their list.
   *   2. Insert with the local chrono-based parse via the optimistic
   *      useCreateTask path; the row paints in the same frame.
   *   3. Run the Anthropic parser in the background. If it picks up
   *      structure the local parser missed (multilingual title rewrite,
   *      "the Friday before the offsite", etc.), patch the new task.
   */
  function submit() {
    const raw = text.trim();
    if (!raw) return;
    const localP = parsed;
    if (!localP.title) localP.title = raw;
    if (eventMode) {
      setOpen(false);
      const cleanTitle = stripEventTriggers(localP.title);
      void createGoogleEvent(cleanTitle || localP.title, localP.start_at ?? localP.due_at);
      return;
    }
    setOpen(false);
    void instantCreateAndRefine(raw, localP);
  }

  /** Round a Date up to the next 15-minute boundary. */
  function roundUpQuarterHour(d: Date): Date {
    const ms = 15 * 60 * 1000;
    return new Date(Math.ceil(d.getTime() / ms) * ms);
  }

  /** POST a Google Calendar event from the Quick Add input. */
  async function createGoogleEvent(title: string, startIso: string | null | undefined) {
    let start: Date;
    if (startIso) start = new Date(startIso);
    else start = roundUpQuarterHour(new Date(Date.now() + 60 * 60 * 1000));
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    try {
      const res = await fetch("/api/calendar/google/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, start_at: start.toISOString(), end_at: end.toISOString(), is_all_day: false }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        toast.error(msg || "Could not create event on Google Calendar");
        return;
      }
      toast.success("Event created on Google Calendar");
    } catch (err: any) {
      toast.error(err?.message || "Could not create event on Google Calendar");
    }
  }

  /** Remove the calendar trigger words from the title before saving. */
  function stripEventTriggers(title: string): string {
    return title.replace(EVENT_TRIGGER_RE, "").replace(/\s+/g, " ").trim();
  }

  async function instantCreateAndRefine(raw: string, p: ParsedQuickInput) {
    // Resolve project id locally only if it already exists; defer
    // creating a fresh project to the AI-refine step so the optimistic
    // insert doesn't wait on a round-trip.
    let projectId: string | null = null;
    if (p.projectName) {
      const found = projects.find(
        (pr: any) => pr.name.toLowerCase() === p.projectName!.toLowerCase()
      );
      if (found) projectId = found.id;
    }

    let createdTask: any;
    try {
      createdTask = await createTask.mutateAsync({
        title: p.title,
        start_at: p.start_at,
        due_at: p.due_at,
        is_all_day: p.is_all_day,
        priority: p.priority,
        tagNames: p.tagNames,
        project_id: projectId,
        rrule: p.rrule,
        reminder_at: p.reminder_at,
      } as any);
    } catch {
      return; // useCreateTask shows a toast and rolls back optimistically.
    }
    if (!createdTask?.id) return;

    // Skip the AI hop when local parse already captured everything
    // obvious — saves an Anthropic call when the user typed plain English.
    const localGotEnough =
      !!p.due_at && /^[\x00-\x7F]*$/.test(raw) && raw.length < 80;
    if (localGotEnough) return;

    try {
      const ai = await aiParse.mutateAsync(raw);
      if (!ai || !ai.title) return;

      let aiProjectId = projectId;
      if (ai.projectName && !aiProjectId) {
        const found = projects.find(
          (pr: any) => pr.name.toLowerCase() === ai.projectName!.toLowerCase()
        );
        aiProjectId = found
          ? found.id
          : (await createProject.mutateAsync({ name: ai.projectName })).id;
      }

      const patch: Record<string, any> = { id: createdTask.id };
      if (ai.title && ai.title !== p.title) patch.title = ai.title;
      if (ai.due_at && !p.due_at) {
        patch.due_at = ai.due_at;
        patch.is_all_day = ai.is_all_day;
      }
      if (ai.start_at && !p.start_at) {
        patch.start_at = ai.start_at;
      }
      if (ai.priority && ai.priority > p.priority) patch.priority = ai.priority;
      if (ai.rrule && !p.rrule) patch.rrule = ai.rrule;
      if (ai.reminder_at && !p.reminder_at) patch.reminder_at = ai.reminder_at;
      if (aiProjectId && aiProjectId !== projectId) patch.project_id = aiProjectId;

      if (Object.keys(patch).length > 1) {
        updateTask.mutate(patch as any);
      }
    } catch {
      // AI failure is silent — local-parsed task is already saved.
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center px-4 bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="card surface-strong w-full max-w-2xl p-4 md:p-5 space-y-3 md:space-y-4 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* "Now" anchor */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-fg min-w-0">
          <span className="editorial-number uppercase tracking-[0.18em] shrink-0">{tr(lang, "quickAdd.kicker")}</span>
          <span className="truncate">{describeNow(now)}</span>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <input
            ref={inputRef}
            className="flex-1 min-w-0 bg-transparent outline-none text-base md:text-lg placeholder:text-muted-fg"
            placeholder={tr(lang, "quickAdd.placeholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            onPaste={(e) => { const items = e.clipboardData?.items; if (!items) return; for (const it of Array.from(items)) { if (it.kind === "file" && it.type.startsWith("image/")) { const f = it.getAsFile(); if (f) { e.preventDefault(); setScanFile(f); setScanOpen(true); return; } } } }}
          />
          <VoiceButton onTranscript={(t) => setText(t)} onFinal={(t) => setText(t)} />
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="btn-ghost h-9 w-9 inline-flex items-center justify-center rounded-full border border-border text-muted-fg hover:text-fg shrink-0"
            title={tr(lang, "quickAdd.scanTitle")}
            aria-label={tr(lang, "quickAdd.scanAria")}
          >
            <ScanLine className="size-4" />
          </button>
        </div>

        {/* Conversational preview */}
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-fg flex items-start gap-2 min-w-0">
          <Sparkles className="size-4 text-muted-fg shrink-0 mt-0.5" />
          <p className="leading-relaxed min-w-0 flex-1 break-words">{preview}</p>
        </div>

        {/* Live activation row + mini Eisenhower */}
        <div className="grid md:grid-cols-[1fr_auto] gap-3 md:gap-4 min-w-0">
          <div className="space-y-2 content-start min-w-0">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => { const next = !eventMode; manualOverrideRef.current = next; setEventMode(next); }}
                aria-pressed={eventMode}
                className={cn(
                  "h-6 px-2 inline-flex items-center gap-1 rounded-full border text-xs transition-colors",
                  eventMode
                    ? "border-sky-500/60 bg-sky-500/15 text-sky-600"
                    : "border-border text-muted-fg hover:bg-muted hover:text-fg"
                )}
                title="Create a Google Calendar event instead of a task"
              >
                <CalendarPlus className="size-3.5" />
                Event
              </button>
              <Chip
                kind="time"
                active={!!parsed.due_at}
                open={activeChip === "time"}
                onClick={() => setActiveChip(activeChip === "time" ? null : "time")}
                icon={<CalendarClock className="size-3.5" />}
                label={parsed.due_at ? formatDueShort(parsed.due_at, parsed.is_all_day) : tr(lang, "quickAdd.chipTime")}
              />
              <Chip
                kind="repeat"
                active={!!parsed.rrule}
                open={activeChip === "repeat"}
                onClick={() => setActiveChip(activeChip === "repeat" ? null : "repeat")}
                icon={<Repeat className="size-3.5" />}
                label={parsed.rrule ? rruleShortI18n(parsed.rrule, lang) : tr(lang, "quickAdd.chipRepeat")}
              />
              <Chip
                kind="reminder"
                active={!!parsed.reminder_at}
                open={activeChip === "reminder"}
                onClick={() => setActiveChip(activeChip === "reminder" ? null : "reminder")}
                icon={<Bell className="size-3.5" />}
                label={parsed.reminder_at ? reminderShort(parsed.reminder_at, parsed.due_at) : tr(lang, "quickAdd.chipReminder")}
              />
              <Chip
                kind="priority"
                active={parsed.priority > 0}
                open={activeChip === "priority"}
                onClick={() => setActiveChip(activeChip === "priority" ? null : "priority")}
                icon={<Flag className="size-3.5" />}
                label={parsed.priority > 0 ? priorityWordI18n(parsed.priority, lang) : tr(lang, "quickAdd.chipPriority")}
                tone={priorityTone(parsed.priority)}
              />
              <Chip
                kind="inbox"
                active={!!parsed.projectName}
                open={activeChip === "inbox"}
                onClick={() => setActiveChip(activeChip === "inbox" ? null : "inbox")}
                icon={<Folder className="size-3.5" />}
                label={parsed.projectName ?? tr(lang, "quickAdd.chipInbox")}
              />
              {parsed.tagNames.map((t) => {
                // Same color-pill treatment as the sidebar / inline input so
                // a tag looks like a tag everywhere it shows up.
                const existing = existingTags.find(
                  (x: any) => x.name.toLowerCase() === t.toLowerCase()
                );
                const color = existing?.color ?? "var(--accent, #b8860b)";
                return (
                  <span
                    key={t}
                    className="inline-flex items-center h-6 rounded px-2 text-xs font-medium leading-none"
                    style={{ backgroundColor: color, color: "#fff" }}
                  >
                    {t}
                  </span>
                );
              })}
              <Chip
                kind="tags"
                active={false}
                open={activeChip === "tags"}
                onClick={() => setActiveChip(activeChip === "tags" ? null : "tags")}
                icon={<Hash className="size-3.5" />}
                label={tr(lang, "quickAdd.chipTag")}
              />
            </div>
            {activeChip && (
              <ChipOptions
                kind={activeChip}
                projects={projects.map((pr: any) => pr.name)}
                onPick={(phrase) =>
                  injectPhrase(
                    phrase,
                    activeChip === "tags" ? null : (activeChip as keyof typeof STRIP_PATTERNS)
                  )
                }
                onClose={() => setActiveChip(null)}
                lang={lang}
              />
            )}
          </div>
          <MiniEisenhower
            active={quadrant}
            onPick={(phrase) => injectPhrase(phrase, "priority")}
            lang={lang}
          />
        </div>

        {/* Examples (only on empty input). On mobile show only the first 2;
            the full list returns on >=md viewports. */}
        {!text && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex, i) => (
              <button
                key={ex}
                type="button"
                className={cn(
                  "text-[11px] text-muted-fg hover:text-fg border border-border rounded-full px-2 py-0.5",
                  i >= 2 && "hidden md:inline-flex"
                )}
                onClick={() => setText(ex)}
              >
                {ex.length > 56 ? ex.slice(0, 54) + "…" : ex}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-fg pt-1 min-w-0">
          <span className="hidden md:inline truncate">
            Hints: <code>{tr(lang, "quickAdd.exampleTomorrow9am")}</code>, <code>{tr(lang, "quickAdd.exampleEveryMonday")}</code>,{" "}
            <code>{tr(lang, "quickAdd.exampleRemind30m")}</code>, <code>urgent</code>,{" "}
            <code>#tag</code>, <code>~ListName</code>
          </span>
          <span className="ml-auto shrink-0">
            <span className="md:hidden">{tr(lang, "quickAdd.kbHint")}</span>
            <span className="hidden md:inline">{tr(lang, "quickAdd.enterToAdd")}</span>
          </span>
        </div>
      </div>
      <ScanTasksSheet
        open={scanOpen}
        initialFile={scanFile}
        onClose={() => setScanOpen(false)}
        onCreated={() => {
          // After bulk-create, close QuickAdd too — same end state as
          // submitting a single task.
          setOpen(false);
        }}
      />
    </div>
  );
}

/* ---------- small components ---------- */

function Activator({
  active, icon, label, tone,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  tone?: "high" | "med" | "low" | "none";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 h-6 rounded-full text-xs border transition-all",
        active
          ? tone === "high"
            ? "border-p-high text-p-high bg-p-high/10"
            : tone === "med"
              ? "border-p-med text-p-med bg-p-med/10"
              : tone === "low"
                ? "border-p-low text-p-low bg-p-low/10"
                : "border-fg text-fg bg-muted"
          : "border-border text-muted-fg bg-transparent"
      )}
    >
      {icon}
      {label}
    </span>
  );
}

type Quadrant = "q1" | "q2" | "q3" | "q4" | null;

function classifyQuadrant(p: ParsedQuickInput, now: Date): Quadrant {
  if (!p.title) return null;
  // Priority alone gives a baseline mapping so typing just "urgent",
  // "important", "low priority", or "no priority" lights up the
  // matching cell even before a date is added:
  //   p=5 → q1 Do first   (urgent + important)
  //   p=3 → q2 Schedule   (important, not urgent)
  //   p=1 → q3 Delegate   (not important — drop or hand off)
  //   p=0 → q4 Eliminate
  let q: Exclude<Quadrant, null>;
  if (p.priority >= 5) q = "q1";
  else if (p.priority >= 3) q = "q2";
  else if (p.priority >= 1) q = "q3";
  else q = "q4";
  // A near-term date (today / tomorrow / past) adds the urgency layer:
  // Schedule (q2) → Do first (q1), Eliminate (q4) → Delegate (q3).
  const tomorrow = addDays(now, 1);
  const dateUrgent = p.due_at
    ? (() => {
        const d = new Date(p.due_at);
        return isToday(d) || isPast(d) || d <= tomorrow;
      })()
    : false;
  if (dateUrgent) {
    if (q === "q2") q = "q1";
    else if (q === "q4") q = "q3";
  }
  return q;
}

/**
 * Re-color a CSS color (hex or rgb/rgba) with a given alpha (0-100 percent).
 * `opacityPercent === 100` returns the input untouched so existing rgba()
 * colors keep their baked-in alpha.
 */
function applyAlpha(color: string | null | undefined, opacityPercent: number): string | undefined {
  if (!color) return undefined;
  const pct = Math.max(0, Math.min(100, opacityPercent));
  if (pct >= 100) return color;
  const a = pct / 100;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(color);
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${a})`;
  }
  return color;
}

const QA_LS_KEY = "fl.quadrants.qa.cache";

type QaOverrideMap = Partial<Record<Exclude<Quadrant, null>, { label?: string; fg?: string; bg?: string; border?: string; bgOpacity?: number; bgBlur?: number }>>;

function readQaCache(): QaOverrideMap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(QA_LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as QaOverrideMap;
  } catch {
    return null;
  }
}

function writeQaCache(data: QaOverrideMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QA_LS_KEY, JSON.stringify(data));
  } catch {}
}

function MiniEisenhower({ active, onPick, lang }: { active: Quadrant; onPick: (phrase: string) => void; lang: string }) {
  // Each cell injects a phrase that the parser will resolve into that
  // quadrant: priority + (where needed) urgency cue.
  type Cell = {
    key: Exclude<Quadrant, null>; label: string; phrase: string;
    fg: string; bg: string; border: string;
    bgOpacity: number; bgBlur: number;
  };
  const DEFAULTS: Cell[] = [
    { key: "q1", label: tr(lang, "quickAdd.q1"),  phrase: "urgent",       fg: "#B91C1C", bg: "rgba(239, 68, 68, 0.10)",  border: "#EF4444", bgOpacity: 100, bgBlur: 0 },
    { key: "q2", label: tr(lang, "quickAdd.q2"),  phrase: "important",    fg: "#047857", bg: "rgba(16, 185, 129, 0.10)", border: "#10B981", bgOpacity: 100, bgBlur: 0 },
    { key: "q3", label: tr(lang, "quickAdd.q3"),  phrase: "low priority", fg: "#B45309", bg: "rgba(245, 158, 11, 0.12)", border: "#F59E0B", bgOpacity: 100, bgBlur: 0 },
    { key: "q4", label: tr(lang, "quickAdd.q4"),  phrase: "no priority",  fg: "#475569", bg: "rgba(100, 116, 139, 0.10)", border: "#94A3B8", bgOpacity: 100, bgBlur: 0 },
  ];
  // Admin-configured (`site_quadrant_config`) labels, colors, and the
  // glassmorphism dials. Overlaid on top of defaults so any field the
  // admin hasn't changed keeps its baseline.
  // Lazy initial state hydrates synchronously from localStorage so the
  // first paint matches the admin's saved values (no FOUC).
  const [overrides, setOverrides] = useState<QaOverrideMap>(() => readQaCache() ?? {});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const locale =
          (typeof navigator !== "undefined" && navigator.language) || "en";
        const candidates = [locale, locale.split("-")[0] ?? "en", "en"];
        for (const c of candidates) {
          const res = await fetch(
            `/api/keywords/quadrants?locale=${encodeURIComponent(c)}`
          );
          if (!res.ok) continue;
          const j = await res.json().catch(() => ({}));
          const rows = (j.rows ?? []) as Array<{
            quadrant: "q1" | "q2" | "q3" | "q4";
            label: string | null;
            fg_color: string | null;
            bg_color: string | null;
            border_color: string | null;
            bg_opacity: number | null;
            bg_blur: number | null;
          }>;
          if (rows.length) {
            if (!cancelled) {
              const map: typeof overrides = {};
              for (const r of rows) {
                const k = r.quadrant as Exclude<Quadrant, null>;
                if (!["q1","q2","q3","q4"].includes(k)) continue;
                map[k] = {
                  label: r.label ?? undefined,
                  fg: r.fg_color ?? undefined,
                  bg: r.bg_color ?? undefined,
                  border: r.border_color ?? undefined,
                  bgOpacity: r.bg_opacity ?? undefined,
                  bgBlur: r.bg_blur ?? undefined,
                };
              }
              setOverrides(map);
              writeQaCache(map);
            }
            return;
          }
        }
      } catch {
        // Silent fall back to defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const cells: Cell[] = DEFAULTS.map((d) => {
    const o = overrides[d.key] ?? {};
    return {
      ...d,
      label: o.label || d.label,
      fg: o.fg || d.fg,
      bg: o.bg || d.bg,
      border: o.border || d.border,
      bgOpacity: o.bgOpacity == null ? d.bgOpacity : o.bgOpacity,
      bgBlur: o.bgBlur == null ? d.bgBlur : o.bgBlur,
    };
  });
  return (
    <div className="shrink-0 self-start">
      <div className="grid grid-cols-2 gap-1 w-[176px]">
        {cells.map((c) => {
          const isActive = active === c.key;
          // Active cell uses solid fg as bg (no opacity dial); idle cell
          // honors the admin's opacity + blur settings.
          const cellBg = isActive ? c.fg : applyAlpha(c.bg, c.bgOpacity);
          const blur = !isActive && c.bgBlur > 0 ? `blur(${c.bgBlur}px)` : undefined;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onPick(c.phrase)}
              style={{
                backgroundColor: cellBg,
                color: isActive ? "white" : c.fg,
                borderColor: c.border,
                borderTopWidth: 3,
                backdropFilter: blur,
                WebkitBackdropFilter: blur,
              }}
              className={cn(
                "h-12 rounded-md border text-[10px] grid place-items-center text-center px-1 transition-all",
                "hover:brightness-95 active:scale-[0.98]",
                isActive && "shadow-md font-medium"
              )}
              title={`Insert "${c.phrase}"`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-fg text-center mt-1">{tr(lang, "quickAdd.miniSiftCaption")}</div>
    </div>
  );
}

/* ---------- formatters ---------- */

function priorityWord(p: number) {
  if (p >= 5) return "High";
  if (p >= 3) return "Medium";
  if (p >= 1) return "Low";
  return "None";
}
function priorityWordI18n(p: number, lang: string) {
  if (p >= 5) return tr(lang, "quickAdd.priorityHigh");
  if (p >= 3) return tr(lang, "quickAdd.priorityMedium");
  if (p >= 1) return tr(lang, "quickAdd.priorityLow");
  return tr(lang, "quickAdd.priorityNone");
}
function rruleShortI18n(rule: string, lang: string) {
  if (/FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR/i.test(rule)) return tr(lang, "quickAdd.repeatWeekdays");
  const dom = rule.match(/FREQ=WEEKLY;BYDAY=([A-Z]{2})$/i);
  if (dom) {
    return rruleShort(rule);
  }
  if (/FREQ=DAILY/i.test(rule)) return tr(lang, "quickAdd.repeatDaily");
  if (/FREQ=WEEKLY/i.test(rule)) return tr(lang, "quickAdd.repeatWeekly");
  if (/FREQ=MONTHLY/i.test(rule)) return tr(lang, "quickAdd.repeatMonthly");
  if (/FREQ=YEARLY/i.test(rule)) return tr(lang, "quickAdd.repeatYearly");
  return tr(lang, "quickAdd.repeatRepeats");
}
function priorityTone(p: number): "high" | "med" | "low" | "none" {
  if (p >= 5) return "high";
  if (p >= 3) return "med";
  if (p >= 1) return "low";
  return "none";
}
function rruleShort(rule: string) {
  if (/FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR/i.test(rule)) return "Weekdays";
  const dom = rule.match(/FREQ=WEEKLY;BYDAY=([A-Z]{2})$/i);
  if (dom) {
    const m: Record<string, string> = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" };
    return `Every ${m[dom[1]!.toUpperCase()] ?? dom[1]}`;
  }
  if (/FREQ=DAILY/i.test(rule)) return "Daily";
  if (/FREQ=WEEKLY/i.test(rule)) return "Weekly";
  if (/FREQ=MONTHLY/i.test(rule)) return "Monthly";
  if (/FREQ=YEARLY/i.test(rule)) return "Yearly";
  return "Repeats";
}
function reminderShort(reminderIso: string, dueIso: string | null) {
  if (!dueIso) return new Date(reminderIso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const offsetMs = new Date(dueIso).getTime() - new Date(reminderIso).getTime();
  if (offsetMs <= 0) return new Date(reminderIso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const min = Math.round(offsetMs / 60_000);
  if (min >= 60 && min % 60 === 0) {
    const h = min / 60;
    return `${h}h before`;
  }
  return `${min}m before`;
}
function formatDueShort(iso: string, allDay: boolean) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today); dayAfter.setDate(dayAfter.getDate() + 2);
  const dayPart =
    d >= today && d < tomorrow
      ? "Today"
      : d >= tomorrow && d < dayAfter
      ? "Tomorrow"
      : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (allDay) return dayPart;
  return `${dayPart} ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}


/* ---------- Clickable chip + popover ---------- */

function Chip({
  active, open, icon, label, onClick, tone,
}: {
  kind: "time" | "repeat" | "reminder" | "priority" | "inbox" | "tags";
  active: boolean;
  open: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "high" | "med" | "low" | "none";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 h-6 rounded-full text-xs border transition-all",
        active
          ? tone === "high"
            ? "border-p-high text-p-high bg-p-high/10"
            : tone === "med"
              ? "border-p-med text-p-med bg-p-med/10"
              : tone === "low"
                ? "border-p-low text-p-low bg-p-low/10"
                : "border-fg text-fg bg-muted"
          : "border-border text-muted-fg hover:border-fg/40 hover:text-fg",
        open && "ring-2 ring-accent/40"
      )}
    >
      {icon}
      {label}
      <ChevronDown className="size-3 opacity-60" />
    </button>
  );
}

function ChipOptions({
  kind, projects, onPick, onClose, lang,
}: {
  kind: "time" | "repeat" | "reminder" | "priority" | "inbox" | "tags";
  projects: string[];
  onPick: (phrase: string) => void;
  onClose: () => void;
  lang: string;
}) {
  const options: Record<string, Array<{ label: string; phrase: string }>> = {
    time: [
      { label: tr(lang, "quickAdd.timeToday"),    phrase: "today" },
      { label: "Tonight",                          phrase: "tonight" },
      { label: tr(lang, "quickAdd.timeTomorrow"), phrase: "tomorrow 9am" },
      { label: "This Friday",                      phrase: "this Friday" },
      { label: "Next Monday",                      phrase: "next Monday 9am" },
      { label: "Next week",                        phrase: "next week" },
    ],
    repeat: [
      { label: tr(lang, "quickAdd.repeatDaily"),    phrase: "every day" },
      { label: tr(lang, "quickAdd.repeatWeekdays"), phrase: "every weekday" },
      { label: tr(lang, "quickAdd.repeatWeekly"),   phrase: "every week" },
      { label: tr(lang, "quickAdd.repeatMonthly"),  phrase: "every month" },
      { label: tr(lang, "quickAdd.repeatYearly"),   phrase: "every year" },
    ],
    reminder: [
      { label: "10m before", phrase: "remind me 10m before" },
      { label: "30m before", phrase: "remind me 30m before" },
      { label: "1h before",  phrase: "remind me 1h before" },
      { label: "1d before",  phrase: "remind me 1 day before" },
    ],
    priority: [
      { label: "Urgent",    phrase: "urgent" },
      { label: "Important", phrase: "important" },
      { label: tr(lang, "quickAdd.priorityLow"),  phrase: "low priority" },
      { label: tr(lang, "quickAdd.priorityNone"), phrase: "no priority" },
    ],
    inbox: projects.length
      ? projects.slice(0, 8).map((name) => ({ label: name, phrase: "~" + name }))
      : [{ label: tr(lang, "quickAdd.chipInbox"), phrase: "~Inbox" }],
    tags: [],
  };

  if (kind === "tags") {
    // Tags: focus the input with a leading "#" so the user types the name.
    return (
      <div className="text-[11px] text-muted-fg pl-1">
        Type <code className="text-fg">#tagname</code> in the input above —{" "}
        <button
          type="button"
          className="underline hover:text-fg"
          onClick={() => onPick("#")}
        >
          insert “#” at cursor
        </button>
      </div>
    );
  }

  if (kind === "time") {
    return (
      <div className="flex flex-wrap items-center gap-1.5 pl-1">
        {options.time!.map((o) => (
          <OptionPill key={o.label} label={o.label} onClick={() => onPick(o.phrase)} />
        ))}
        <DateTimePicker onPick={onPick} />
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-muted-fg hover:text-fg ml-1"
        >
          {tr(lang, "quickAdd.cancel")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 pl-1">
      {options[kind]!.map((o) => (
        <OptionPill key={o.label} label={o.label} onClick={() => onPick(o.phrase)} />
      ))}
      <button
        type="button"
        onClick={onClose}
        className="text-[11px] text-muted-fg hover:text-fg ml-1"
      >
        {tr(lang, "quickAdd.cancel")}
      </button>
    </div>
  );
}

function OptionPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center h-6 rounded-full border border-border px-2 text-[11px] text-fg hover:bg-muted hover:border-fg/40 transition-colors"
    >
      {label}
    </button>
  );
}

/** Date + Time picker. Two native inputs side by side; once the user
 *  has chosen at least a date, the combined phrase is injected into
 *  the parent input ("on 2026-04-30 14:00"). Time alone (without
 *  date) injects an "at HH:MM" phrase. The chrono-node parser then
 *  resolves both shapes correctly. */
function DateTimePicker({ onPick }: { onPick: (phrase: string) => void }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  function commit(d: string, tm: string) {
    if (d && tm) onPick(`on ${d} ${tm}`);
    else if (d) onPick(`on ${d}`);
    else if (tm) onPick(`at ${tm}`);
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="date"
        value={date}
        onChange={(e) => {
          const v = e.target.value;
          setDate(v);
          commit(v, time);
        }}
        className="h-6 rounded-full border border-border px-2 text-[11px] text-muted-fg bg-transparent hover:text-fg focus:text-fg focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      <input
        type="time"
        value={time}
        onChange={(e) => {
          const v = e.target.value;
          setTime(v);
          commit(date, v);
        }}
        className="h-6 rounded-full border border-border px-2 text-[11px] text-muted-fg bg-transparent hover:text-fg focus:text-fg focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </span>
  );
}
