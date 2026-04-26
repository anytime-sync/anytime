"use client";

import { X, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Tag } from "@/lib/db.types";
import { useTags, useAddTaskTag, useRemoveTaskTag } from "@/hooks/use-tags";
import { cn } from "@/lib/utils";

/**
 * Tag editor for the task detail panel.
 *
 * - Currently-applied tags render as filled color-block pills (same
 *   visual language as the sidebar). × removes them from this task.
 * - The input is a combobox: typing matches existing tags; Enter
 *   commits (creating a new tag if none matches).
 * - When the typed name is NEW, the suggestion row also shows a
 *   palette of swatches — clicking one creates the tag with that color
 *   in a single step. Plain Enter falls back to a randomly-picked
 *   palette color so users never end up with the default grey unless
 *   they explicitly choose it.
 */

// First-Light-aligned tag palette: muted, warm, brand-friendly.
const TAG_COLORS = [
  "#5B7FE8", // soft cobalt
  "#7DB48F", // sage green
  "#C76A6A", // dusty red
  "#D08C5A", // warm terracotta
  "#C8A24F", // muted gold
  "#5BA8A8", // soft teal
  "#9B7FB8", // muted lavender
  "#C77FA0", // soft rose
  "#7E8A9C", // blue-grey
];

function pickRandomColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]!;
}

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
    return pool.filter((t) => t.name.toLowerCase().includes(query)).slice(0, 8);
  }, [allTags, currentIds, query]);

  const exactMatch = allTags.find(
    (t) => t.name.toLowerCase() === query && !currentIds.has(t.id)
  );
  const showCreate = query.length > 0 && !exactMatch;

  function commitNew(name: string, color: string) {
    const clean = name.trim().replace(/^#/, "");
    if (!clean) return;
    addTag.mutate({ taskId, name: clean, color });
    setInput("");
    setOpen(true);
    inputRef.current?.focus();
  }

  function commitExisting(t: Tag) {
    addTag.mutate({ taskId, name: t.name, color: t.color ?? "#6b7280" });
    setInput("");
    setOpen(true);
    inputRef.current?.focus();
  }

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="flex flex-wrap gap-1 items-center min-h-9 rounded-md border border-border bg-bg px-2 py-1.5 focus-within:ring-2 focus-within:ring-accent/30"
        onClick={() => inputRef.current?.focus()}
      >
        {currentTags.map((t) => (
          <TagPill key={t.id} tag={t} onRemove={() => removeTag.mutate({ taskId, tagId: t.id })} />
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
              if (exactMatch) commitExisting(exactMatch);
              else if (query) commitNew(query, pickRandomColor());
            } else if (e.key === "Backspace" && !input && currentTags.length) {
              const last = currentTags[currentTags.length - 1];
              removeTag.mutate({ taskId, tagId: last.id });
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={currentTags.length ? "" : "Add tag…"}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-sm py-0.5"
        />
      </div>

      {open && (suggestions.length > 0 || showCreate) && (
        <div className="absolute z-30 mt-1 left-0 right-0 max-h-64 overflow-y-auto rounded-md border border-border surface shadow-lg p-1">
          {suggestions.map((t) => (
            <button
              key={t.id}
              type="button"
              className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-2"
              onClick={() => commitExisting(t)}
            >
              <span
                className="inline-block size-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: t.color ?? "#6b7280" }}
              />
              <span className="flex-1 truncate">{t.name}</span>
            </button>
          ))}
          {showCreate && (
            <div className="px-2 py-1.5 border-t border-border first:border-t-0">
              <div className="flex items-center gap-2 text-sm text-muted-fg mb-2">
                <Plus className="size-3.5" />
                Create tag <span className="text-fg font-medium">{query}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    aria-label={`Create with color ${c}`}
                    onClick={() => commitNew(query, c)}
                    className="size-6 rounded-md transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-fg/30 focus:ring-offset-1"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <p className="text-[10px] text-muted-fg mt-1.5">Pick a color, or just press Enter for a random one.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Pill ---------- */

function TagPill({ tag, onRemove }: { tag: Tag; onRemove: () => void }) {
  const fg = readableTextColor(tag.color ?? "#6b7280");
  const subtleFg = fg === "#fff" ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.55)";
  return (
    <span
      className="inline-flex items-stretch h-6 rounded-md overflow-hidden text-sm leading-none font-medium"
      style={{ backgroundColor: tag.color ?? "#6b7280", color: fg }}
    >
      <span className="inline-flex items-center px-2">{tag.name}</span>
      <button
        type="button"
        aria-label={`Remove ${tag.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="inline-flex items-center justify-center w-5 transition-colors"
        style={{ color: subtleFg }}
        onMouseEnter={(e) => (e.currentTarget.style.color = fg)}
        onMouseLeave={(e) => (e.currentTarget.style.color = subtleFg)}
      >
        <X className="size-3" strokeWidth={2.5} />
      </button>
    </span>
  );
}

/* ---------- helpers ---------- */

function readableTextColor(hex: string): "#fff" | "#111" {
  const { r, g, b } = parseHex(hex);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.62 ? "#111" : "#fff";
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2) || "0", 16);
  const g = parseInt(h.slice(2, 4) || "0", 16);
  const b = parseInt(h.slice(4, 6) || "0", 16);
  return { r, g, b };
}
