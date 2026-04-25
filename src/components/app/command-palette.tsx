"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUIStore } from "@/store/ui";
import { useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useTags } from "@/hooks/use-tags";
import { useRouter } from "next/navigation";
import { Hash, Folder, ListTodo } from "lucide-react";

export function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen);
  const setOpen = useUIStore((s) => s.setCommandOpen);
  const setSelected = useUIStore((s) => s.setSelectedTaskId);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const { data: tasks = [] } = useTasks({ includeCompleted: true });
  const { data: projects = [] } = useProjects();
  const { data: tags = [] } = useTags();

  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const results = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) {
      return {
        tasks: tasks.slice(0, 8),
        projects: projects.slice(0, 5),
        tags: tags.slice(0, 5),
      };
    }
    return {
      tasks: tasks
        .filter((t) =>
          [t.title, t.notes ?? ""].some((s) => s.toLowerCase().includes(ql))
        )
        .slice(0, 8),
      projects: projects.filter((p) => p.name.toLowerCase().includes(ql)).slice(0, 5),
      tags: tags.filter((t) => t.name.toLowerCase().includes(ql)).slice(0, 5),
    };
  }, [q, tasks, projects, tags]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-start pt-[12vh] bg-black/40 animate-fade-in" onClick={() => setOpen(false)}>
      <div className="card w-[90vw] max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="w-full bg-transparent outline-none text-base px-4 h-12 border-b border-border"
          placeholder="Search tasks, lists, tags…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="max-h-[60vh] overflow-y-auto p-2 text-sm">
          {results.tasks.length > 0 && (
            <Section title="Tasks">
              {results.tasks.map((t) => (
                <button
                  key={t.id}
                  className="w-full flex items-center gap-2 px-2 h-9 rounded-md hover:bg-muted text-left"
                  onClick={() => {
                    setSelected(t.id);
                    setOpen(false);
                  }}
                >
                  <ListTodo className="size-4 text-muted-fg" />
                  <span className="truncate">{t.title}</span>
                  {t.is_completed && (
                    <span className="ml-auto text-xs text-muted-fg">done</span>
                  )}
                </button>
              ))}
            </Section>
          )}
          {results.projects.length > 0 && (
            <Section title="Lists">
              {results.projects.map((p) => (
                <button
                  key={p.id}
                  className="w-full flex items-center gap-2 px-2 h-9 rounded-md hover:bg-muted text-left"
                  onClick={() => {
                    router.push(`/app/lists/${p.id}`);
                    setOpen(false);
                  }}
                >
                  <Folder className="size-4" style={{ color: p.color }} />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </Section>
          )}
          {results.tags.length > 0 && (
            <Section title="Tags">
              {results.tags.map((t) => (
                <button
                  key={t.id}
                  className="w-full flex items-center gap-2 px-2 h-9 rounded-md hover:bg-muted text-left"
                  onClick={() => {
                    router.push(`/app/tags/${encodeURIComponent(t.name)}`);
                    setOpen(false);
                  }}
                >
                  <Hash className="size-4" style={{ color: t.color }} />
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </Section>
          )}
          {results.tasks.length + results.projects.length + results.tags.length === 0 && (
            <div className="px-3 py-6 text-center text-muted-fg">No results.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-2 text-xs uppercase tracking-wider text-muted-fg pb-1">{title}</div>
      {children}
    </div>
  );
}
