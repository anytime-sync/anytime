"use client";

import { Hash, X, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Tag } from "@/lib/db.types";
import { useTags, useAddTaskTag, useRemoveTaskTag } from "@/hooks/use-tags";
import { cn } from "@/lib/utils";

/**
 * Chips for current tags (×-removable) plus an inline combobox to add tags.
 * Typing matches against existing tags; pressing Enter adds the typed name
 * (creating a new tag if it doesn't exist yet).
 */
export function TagEditor({
  taskId,
  currentTags,
}: {
  taskId: string;
  currentTags: Tag[];
}) {
  const { data: allTags = [] } = useTags();
  const addTag = useAddTaskTag();
  const removeTag = useRemoveTaskTag();

  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const currentIds = useMemo(() => new Set(currentTags.map((t) => t.id)), [currentTags]);
  const query = input.trim().replace(/^#/, "").toLowerCase();
  const suggestions = useMemo(() => {
    const pool = allTags.filter((t) => !currentIds.has(t.id));
    if (!query) return pool.slice(0, 8);
    return pool
      .filter((t) => t.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [allTags, currentIds, query]);

  const exactMatch = allTags.find(
    (t) => t.name.toLowerCase() === query && !currentIds.has(t.id)
  );
  const showCreate = query.length > 0 && !exactMatch;

  function commit(name: string) {
    const clean = name.trim().replace(/^#/, "");
    if (!clean) return;
    addTag.mutate({ taskId, name: clean });
    setInput("");
    setOpen(true);
    inputRef.current?.focus();
  }

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="flex flex-wrap gap-1 items-center min-h-9 rounded-md border border-border bg-bg px-2 py-1 focus-within:ring-2 focus-within:ring-accent/30"
        onClick={() => inputRef.current?.focus()}
      >
        {currentTags.map((t) => (
          <span
            key={t.id}
            className="chip pr-1 group"
            style={{ borderColor: `${t.color}55` }}
          >
            <Hash className="size-3" style={{ color: t.color }} />
            {t.name}
            <button
              type="button"
              aria-label={`Remove ${t.name}`}
              className="ml-1 size-4 rounded-full hover:bg-muted grid place-items-center text-muted-fg hover:text-fg"
              onClick={(e) => {
                e.stopPropagation();
                removeTag.mutate({ taskId, tagId: t.id });
              }}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (exactMatch) commit(exactMatch.name);
              else if (query) commit(query);
            } else if (e.key === "Backspace" && !input && currentTags.length) {
              const last = currentTags[currentTags.length - 1];
              removeTag.mutate({ taskId, tagId: last.id });
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={currentTags.length ? "" : "Add tag…"}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-sm py-1"
        />
      </div>

      {open && (suggestions.length > 0 || showCreate) && (
        <div className="absolute z-30 mt-1 left-0 right-0 max-h-64 overflow-y-auto rounded-md border border-border bg-panel shadow-lg p-1">
          {suggestions.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2"
              )}
              onClick={() => commit(t.name)}
            >
              <Hash className="size-3.5" style={{ color: t.color }} />
              <span className="flex-1 truncate">{t.name}</span>
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2 text-muted-fg"
              onClick={() => commit(query)}
            >
              <Plus className="size-3.5" />
              Create tag <span className="text-fg">#{query}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
