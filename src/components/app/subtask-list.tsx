"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useSubtasks, useCreateTask, useToggleTask, useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";

export function SubtaskList({ parentId, parentProjectId }: { parentId: string; parentProjectId: string | null }) {
  const { data: subtasks = [], isLoading } = useSubtasks(parentId);
  const create = useCreateTask();
  const toggle = useToggleTask();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    await create.mutateAsync({
      title: draft.trim(),
      parent_id: parentId,
      project_id: parentProjectId ?? null,
    });
    setDraft("");
  }

  return (
    <div className="space-y-1">
      {isLoading && (
        <p className="text-xs text-muted-fg">Loading subtasks…</p>
      )}
      {subtasks.map((s) => (
        <div key={s.id} className="group flex items-center gap-2 px-1 py-1 rounded-md hover:bg-muted/60">
          <button
            aria-label="toggle"
            className={cn(
              "size-4 rounded-full border-2 grid place-items-center shrink-0",
              s.is_completed ? "bg-success border-success text-white" : "border-muted-fg"
            )}
            onClick={() => toggle(s)}
          >
            {s.is_completed && (
              <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 6l3 3 5-6" />
              </svg>
            )}
          </button>
          <input
            className={cn(
              "flex-1 bg-transparent outline-none text-sm",
              s.is_completed && "line-through text-muted-fg"
            )}
            defaultValue={s.title}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== s.title) update.mutate({ id: s.id, title: v });
            }}
          />
          <button
            className="opacity-0 group-hover:opacity-100 text-muted-fg hover:text-danger"
            onClick={() => del.mutate(s.id)}
            aria-label="delete subtask"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}

      {adding ? (
        <form onSubmit={add} className="flex items-center gap-2 px-1 py-1">
          <span className="size-4 rounded-full border-2 border-muted-fg shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-fg"
            placeholder="New subtask…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (!draft.trim()) setAdding(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
          />
          <button type="button" onClick={() => { setDraft(""); setAdding(false); }} aria-label="cancel">
            <X className="size-3.5 text-muted-fg" />
          </button>
        </form>
      ) : (
        <button
          className="flex items-center gap-2 text-xs text-muted-fg hover:text-fg px-1 py-1"
          onClick={() => setAdding(true)}
        >
          <Plus className="size-3.5" />
          Add subtask
        </button>
      )}
    </div>
  );
}
