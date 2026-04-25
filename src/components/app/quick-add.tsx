"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseQuickInput, describeParsed, describeNow } from "@/lib/quick-parse";
import { useCreateTask } from "@/hooks/use-tasks";
import { useCreateProject, useProjects } from "@/hooks/use-projects";
import { useUIStore } from "@/store/ui";
import { Sparkles } from "lucide-react";

const EXAMPLES = [
  "Email Sam tomorrow at 9am with a reminder 30 minutes before, urgent #work",
  "Stand-up every weekday at 10am",
  "Pick up groceries on Friday at 6pm in Errands #shopping",
  "Pay rent monthly on the 1st",
  "Call mom Sunday afternoon",
];

export function QuickAdd() {
  const open = useUIStore((s) => s.quickAddOpen);
  const setOpen = useUIStore((s) => s.setQuickAddOpen);
  const [text, setText] = useState("");
  const [now, setNow] = useState(() => new Date());
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();
  const createProject = useCreateProject();
  const { data: projects = [] } = useProjects();

  const parsed = useMemo(() => parseQuickInput(text), [text]);
  const preview = useMemo(() => describeParsed(parsed, now), [parsed, now]);

  // Tick the "now" indicator every minute so descriptions like "in 30 minutes"
  // and "today/tomorrow" stay accurate while the dialog is open.
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

  async function submit() {
    if (!parsed.title) return;
    let projectId: string | null = null;
    if (parsed.projectName) {
      const found = projects.find((p) => p.name.toLowerCase() === parsed.projectName!.toLowerCase());
      if (found) projectId = found.id;
      else {
        const created = await createProject.mutateAsync({ name: parsed.projectName });
        projectId = created.id;
      }
    }
    await createTask.mutateAsync({
      title: parsed.title,
      due_at: parsed.due_at,
      is_all_day: parsed.is_all_day,
      priority: parsed.priority,
      tagNames: parsed.tagNames,
      project_id: projectId,
      rrule: parsed.rrule,
      reminder_at: parsed.reminder_at,
    });
    setOpen(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start pt-[12vh] bg-black/40 animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="card w-[92vw] max-w-2xl p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* "Now" line so the user knows what the parser is anchored to. */}
        <div className="flex items-center justify-between text-[11px] text-muted-fg">
          <span className="editorial-number uppercase tracking-[0.18em]">Quick add</span>
          <span>{describeNow(now)}</span>
        </div>

        <input
          ref={inputRef}
          className="w-full bg-transparent outline-none text-lg placeholder:text-muted-fg"
          placeholder='Tell me what to add — e.g. "Email Sam tomorrow 9am with reminder 30m before, urgent #work"'
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />

        {/* Conversational preview */}
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-fg flex items-start gap-2">
          <Sparkles className="size-4 text-muted-fg shrink-0 mt-0.5" />
          <p className="leading-relaxed">{preview}</p>
        </div>

        {/* Tiny example carousel — clickable so first-time users learn the syntax. */}
        {!text && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                className="text-[11px] text-muted-fg hover:text-fg border border-border rounded-full px-2 py-0.5"
                onClick={() => setText(ex)}
              >
                {ex.length > 60 ? ex.slice(0, 58) + "…" : ex}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-muted-fg pt-1">
          <span>
            Hints: <code>tomorrow 9am</code>, <code>every Monday</code>,{" "}
            <code>remind me 30m before</code>, <code>urgent</code>,{" "}
            <code>#tag</code>, <code>~ListName</code>
          </span>
          <span>Enter to add · Esc to close</span>
        </div>
      </div>
    </div>
  );
}

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}
