"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUIStore } from "@/store/ui";
import { useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useTags } from "@/hooks/use-tags";
import { useRouter } from "next/navigation";
import { Hash, Folder, ListTodo, Sparkles } from "lucide-react";
import { useNlSearch, type SearchMatch } from "@/hooks/use-ai";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CommandPalette() {
  const open = useUIStore((s) => s.commandOpen);
  const setOpen = useUIStore((s) => s.setCommandOpen);
  const setSelected = useUIStore((s) => s.setSelectedTaskId);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [aiMatches, setAiMatches] = useState<SearchMatch[] | null>(null);
  const nlSearch = useNlSearch();
  const { data: tasks = [] } = useTasks({ includeCompleted: true });
  const { data: projects = [] } = useProjects();
  const { data: tags = [] } = useTags();

  // Reset AI matches whenever the query changes — they're stale by then.
  useEffect(() => { setAiMatches(null); }, [q]);

  async function runAiSearch() {
    if (q.trim().length < 3) return;
    try {
      const r = await nlSearch.mutateAsync(q.trim());
      if (!r) {
        toast.error("AI is currently disabled.");
        return;
      }
      setAiMatches(r.matches);
    } catch (e: any) {
      toast.error(e?.message?.includes("429") ? "Search budget reached." : "Couldn't run AI search.");
    }
  }

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
        <div className="flex items-center border-b border-border">
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-base px-4 h-12"
            placeholder="Search tasks, lists, tags… or ask AI"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                runAiSearch();
              }
            }}
          />
          {q.trim().length >= 3 && (
            <button
              type="button"
              className="mr-2 btn-ghost h-8 px-3 text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
              onClick={runAiSearch}
              disabled={nlSearch.isPending}
              title="Re-rank with AI (Cmd/Ctrl+Enter)"
            >
              <Sparkles className={cn("size-3.5", nlSearch.isPending && "animate-spin")} />
              {nlSearch.isPending ? "…" : "Ask AI"}
            </button>
          )}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2 text-sm">
          {aiMatches && aiMatches.length > 0 && (
            <Section title="AI matches">
              {aiMatches.map((m) => {
                const t = tasks.find((x) => x.id === m.id);
                if (!t) return null;
                return (
                  <button
                    key={m.id}
                    className="w-full flex items-start gap-2 px-2 py-2 rounded-md hover:bg-muted text-left"
                    onClick={() => { setSelected(m.id); setOpen(false); }}
                  >
                    <Sparkles className="size-3.5 mt-0.5 text-accent shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{t.title}</div>
                      <div className="text-[11px] text-muted-fg italic mt-0.5">{m.why}</div>
                    </div>
                  </button>
                );
              })}
            </Section>
          )}
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
