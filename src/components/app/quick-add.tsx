"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseQuickInput } from "@/lib/quick-parse";
import { useCreateTask } from "@/hooks/use-tasks";
import { useCreateProject, useProjects } from "@/hooks/use-projects";
import { useUIStore } from "@/store/ui";
import { format } from "date-fns";
import { CalendarDays, Flag, Hash, Folder } from "lucide-react";

export function QuickAdd() {
  const open = useUIStore((s) => s.quickAddOpen);
  const setOpen = useUIStore((s) => s.setQuickAddOpen);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();
  const createProject = useCreateProject();
  const { data: projects = [] } = useProjects();

  const parsed = useMemo(() => parseQuickInput(text), [text]);

  useEffect(() => {
    if (open) {
      setText("");
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
    });
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-start pt-[12vh] bg-black/40 animate-fade-in" onClick={() => setOpen(false)}>
      <div className="card w-[90vw] max-w-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="w-full bg-transparent outline-none text-lg placeholder:text-muted-fg"
          placeholder='Add a task — try "Email Sam tomorrow 9am #work !1 ~Inbox"'
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <div className="flex flex-wrap gap-2 text-xs text-muted-fg">
          {parsed.due_at && (
            <span className="chip">
              <CalendarDays className="size-3" />
              {parsed.is_all_day
                ? format(new Date(parsed.due_at), "EEE, MMM d")
                : format(new Date(parsed.due_at), "EEE, MMM d, h:mm a")}
            </span>
          )}
          {parsed.priority > 0 && (
            <span className="chip">
              <Flag className="size-3" />
              {parsed.priority >= 5 ? "High" : parsed.priority >= 3 ? "Medium" : "Low"}
            </span>
          )}
          {parsed.tagNames.map((t) => (
            <span key={t} className="chip">
              <Hash className="size-3" />{t}
            </span>
          ))}
          {parsed.projectName && (
            <span className="chip">
              <Folder className="size-3" />{parsed.projectName}
            </span>
          )}
          <span className="ml-auto">Press Enter to add · Esc to close</span>
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
