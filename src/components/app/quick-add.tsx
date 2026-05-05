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
  Bell, CalendarClock, Flag, Folder, Hash, Repeat, Sparkles, ChevronDown,
  ScanLine,
} from "lucide-react";
import { ScanTasksSheet } from "./scan-tasks-sheet";
import { addDays, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";

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
  // When the user pastes an image into the input, we open the
  // ScanTasksSheet pre-loaded with that file so the vision OCR
  // auto-runs without an extra click.
  const [pastedFile, setPastedFile] = useState<File | null>(null);

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
  // existing tag names — used both for color resolution on the preview
  // pills AND as auto-detect context for the parser.
  const { data: existingTags = [] } = useTags();
  const aiParse = useParseTaskAI();

  // Admin-curated priority phrases (\`site_priority_keywords\`) that
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
            \`/api/keywords/active?locale=\${encodeURIComponent(c)}\`
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
   *   2. Insert via the optimistic useCreateTask path with the local parse;
   *      the row paints in the same frame.
   *   3. Run the Anthropic parser in the background and patch the new
   *      task if it picks up structure the local parser missed.
   */
  function submit() {
    const raw = text.trim();
    if (!raw) return;
    const localP = parsed;
    if (!localP.title) localP.title = raw;
    setOpen(false);
    void instantCreateAndRefine(raw, localP);
  }

  async function instantCreateAndRefine(raw: string, p: ParsedQuickInput) {
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
      return;
    }
    if (!createdTask?.id) return;

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

      const patch: { id: string } & Record<string, any> = { id: createdTask.id };
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
        updateTask.mutate(patch);
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
          <span className="editorial-number uppercase tracking-[0.18em] shrink-0">Quick add</span>
          <span className="truncate">{describeNow(now)}</span>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <input
            ref={inputRef}
            className="flex-1 min-w-0 bg-transparent outline-none text-base md:text-lg placeholder:text-muted-fg"
            placeholder='Add a task — type or speak'
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            onPaste={(e) => {
              // Pull the first image off the clipboard (screenshots paste
              // as image/png). If found, hand it to the ScanTasksSheet
              // for vision OCR. Falls through to default text paste
              // when no image is present.
              const items = e.clipboardData?.items;
              if (!items) return;
              for (let i = 0; i < items.length; i++) {
                const it = items[i];
                if (it.kind === "file" && it.type.startsWith("image/")) {
                  const f = it.getAsFile();
                  if (f) {
                    e.preventDefault();
                    setPastedFile(f);
                    setScanOpen(true);
                  }
                  return;
                }
              }
            }}
          />
          <VoiceButton onTranscript={(t) => setText(t)} onFinal={(t) => setText(t)} />
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="btn-ghost h-9 w-9 inline-flex items-center justify-center rounded-full border border-border text-muted-fg hover:text-fg shrink-0"
            title="Scan tasks from a photo or screenshot"
            aria-label="Scan tasks from an image"
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
              <Chip
                kind="time"
                active={!!parsed.due_at}
                open={activeChip === "time"}
                onClick={() => setActiveChip(activeChip === "time" ? null : "time")}
                icon={<CalendarClock className="size-3.5" />}
                label={parsed.due_at ? formatDueShort(parsed.due_at, parsed.is_all_day) : "Time"}
              />
              <Chip
                kind="repeat"
                active={!!parsed.rrule}
                open={activeChip === "repeat"}
                onClick={() => setActiveChip(activeChip === "repeat" ? null : "repeat")}
                icon={<Repeat className="size-3.5" />}
                label={parsed.rrule ? rruleShort(parsed.rrule) : "Repeat"}
              />
              <Chip
                kind="reminder"
                active={!!parsed.reminder_at}
                open={activeChip === "reminder"}
                onClick={() => setActiveChip(activeChip === "reminder" ? null : "reminder")}
                icon={<Bell className="size-3.5" />}
                label={parsed.reminder_at ? reminderShort(parsed.reminder_at, parsed.due_at) : "Reminder"}
              />
              <Chip
                kind="priority"
                active={parsed.priority > 0}
                open={activeChip === "priority"}
                onClick={() => setActiveChip(activeChip === "priority" ? null : "priority")}
                icon={<Flag className="size-3.5" />}
                label={parsed.priority > 0 ? priorityWord(parsed.priority) : "Priority"}
                tone={priorityTone(parsed.priority)}
              />
              <Chip
                kind="inbox"
                active={!!parsed.projectName}
                open={activeChip === "inbox"}
                onClick={() => setActiveChip(activeChip === "inbox" ? null : "inbox")}
                icon={<Folder className="size-3.5" />}
                label={parsed.projectName ?? "List"}
              />
              {parsed.tagNames.map((t) => (
                <Activator key={t} active icon={<Hash className="size-3.5" />} label={t} />
              ))}
              <Chip
                kind="tags"
                active={false}
                open={activeChip === "tags"}
                onClick={() => setActiveChip(activeChip === "tags" ? null : "tags")}
                icon={<Hash className="size-3.5" />}
                label="Tag"
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
              />
            )}
          </div>
          <MiniEisenhower
            active={quadrant}
            onPick={(phrase) => injectPhrase(phrase, "priority")}
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
            Hints: <code>tomorrow 9am</code>, <code>every Monday</code>,{" "}
            <code>remind me 30m before</code>, <code>urgent</code>,{" "}
            <code>#tag</code>, <code>~ListName</code>
          </span>
          <span className="ml-auto shrink-0">
            <span className="md:hidden">Enter ↵ · Esc</span>
            <span className="hidden md:inline">Enter to add · Esc to close</span>
          </span>
        </div>
      </div>
      <ScanTasksSheet
        open={scanOpen}
        seedFile={pastedFile}
        onClose={() => { setScanOpen(false); setPastedFile(null); }}
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

function MiniEisenhower({ active, onPick }: { active: Quadrant; onPick: (phrase: string) => void }) {
  // Each cell injects a phrase that the parser will resolve into that
  // quadrant: priority + (where needed) urgency cue.
  const cells: Array<{
    key: Exclude<Quadrant, null>; label: string; phrase: string;
    fg: string; bg: string; border: string;
  }> = [
    { key: "q1", label: "Do first",  phrase: "urgent",       fg: "#B91C1C", bg: "rgba(239, 68, 68, 0.10)",  border: "#EF4444" },
    { key: "q2", label: "Schedule",  phrase: "important",    fg: "#047857", bg: "rgba(16, 185, 129, 0.10)", border: "#10B981" },
    { key: "q3", label: "Delegate",  phrase: "low priority", fg: "#B45309", bg: "rgba(245, 158, 11, 0.12)", border: "#F59E0B" },
    { key: "q4", label: "Eliminate", phrase: "no priority",  fg: "#475569", bg: "rgba(100, 116, 139, 0.10)", border: "#94A3B8" },
  ];
  return (
    <div className="shrink-0 self-start">
      <div className="grid grid-cols-2 gap-1 w-[176px]">
        {cells.map((c) => {
          const isActive = active === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onPick(c.phrase)}
              style={{
                backgroundColor: isActive ? c.fg : c.bg,
                color: isActive ? "white" : c.fg,
                borderColor: c.border,
                borderTopWidth: 3,
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
      <div className="text-[10px] text-muted-fg text-center mt-1">The Sift · click to apply</div>
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
  kind, projects, onPick, onClose,
}: {
  kind: "time" | "repeat" | "reminder" | "priority" | "inbox" | "tags";
  projects: string[];
  onPick: (phrase: string) => void;
  onClose: () => void;
}) {
  const options: Record<string, Array<{ label: string; phrase: string }>> = {
    time: [
      { label: "Today",       phrase: "today" },
      { label: "Tonight",     phrase: "tonight" },
      { label: "Tomorrow",    phrase: "tomorrow 9am" },
      { label: "This Friday", phrase: "this Friday" },
      { label: "Next Monday", phrase: "next Monday 9am" },
      { label: "Next week",   phrase: "next week" },
    ],
    repeat: [
      { label: "Daily",     phrase: "every day" },
      { label: "Weekdays",  phrase: "every weekday" },
      { label: "Weekly",    phrase: "every week" },
      { label: "Monthly",   phrase: "every month" },
      { label: "Yearly",    phrase: "every year" },
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
      { label: "Low",       phrase: "low priority" },
      { label: "None",      phrase: "no priority" },
    ],
    inbox: projects.slice(0, 8).map((name) => ({ label: name, phrase: "~" + name })),
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
          cancel
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
        cancel
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
