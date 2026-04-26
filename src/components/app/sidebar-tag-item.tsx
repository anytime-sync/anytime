"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tag } from "@/lib/db.types";
import { useRenameTag, useDeleteTag, useRecolorTag } from "@/hooks/use-tags";
import { toast } from "sonner";

/**
 * Inline tag pill in the sidebar — same visual language as the
 * task-detail TagEditor. Always-white text, regardless of bg color,
 * for maximum visual consistency.
 *
 * Hover affordances (in order, right-aligned):
 *   - Palette icon → opens a portaled color picker; clicking a swatch
 *     updates tag.color via useRecolorTag.
 *   - X icon → opens the delete-confirm modal.
 *
 * Double-click the pill body = inline rename.
 *
 * The popovers and modal are portaled to <body> to escape the
 * sidebar's backdrop-filter (which would otherwise create a
 * containing block and break position:fixed).
 */

const TAG_COLORS = [
  "#5B7FE8", "#7DB48F", "#C76A6A", "#D08C5A", "#C8A24F", "#E5B23A",
  "#5BA8A8", "#9B7FB8", "#C77FA0", "#B89878", "#7E8A9C",
];

export function SidebarTagItem({
  tag,
  active,
}: {
  tag: Tag;
  active: boolean;
}) {
  const rename = useRenameTag();
  const recolor = useRecolorTag();
  const del = useDeleteTag();
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [colorPos, setColorPos] = useState<{ top: number; left: number } | null>(null);
  const [name, setName] = useState(tag.name);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const href = `/app/tags/${encodeURIComponent(tag.name)}`;

  useEffect(() => setMounted(true), []);
  useEffect(() => setName(tag.name), [tag.name]);
  useEffect(() => {
    if (renaming) setTimeout(() => inputRef.current?.select(), 10);
  }, [renaming]);

  // Close color popover on outside click.
  useEffect(() => {
    if (!colorOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest(`[data-tag-color-pop="${tag.id}"]`)) setColorOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [colorOpen, tag.id]);

  function commitRename() {
    const trimmed = name.trim().replace(/^#/, "");
    if (!trimmed || trimmed === tag.name) {
      setRenaming(false);
      setName(tag.name);
      return;
    }
    rename.mutate(
      { id: tag.id, name: trimmed },
      {
        onError: (e: any) => toast.error(e?.message ?? "Couldn't rename"),
        onSuccess: () => toast.success("Renamed"),
      }
    );
    setRenaming(false);
  }

  async function commitDelete() {
    try {
      await del.mutateAsync(tag.id);
      toast.success(`#${tag.name} deleted`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't delete");
    } finally {
      setConfirming(false);
    }
  }

  function openColorPicker() {
    const rect = colorBtnRef.current?.getBoundingClientRect();
    if (rect) setColorPos({ top: rect.bottom + 6, left: rect.left });
    setColorOpen(true);
  }

  function pickColor(color: string) {
    setColorOpen(false);
    if (color === tag.color) return;
    recolor.mutate(
      { id: tag.id, color },
      {
        onError: (e: any) => toast.error(e?.message ?? "Couldn't change color"),
      }
    );
  }

  if (renaming) {
    return (
      <div
        className="inline-flex items-center h-6 rounded-md px-2 text-sm font-medium leading-none"
        style={{ backgroundColor: tag.color, color: "#fff" }}
      >
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            else if (e.key === "Escape") { setName(tag.name); setRenaming(false); }
          }}
          onBlur={commitRename}
          className="bg-transparent outline-none w-[7ch] min-w-[3ch]"
          style={{ color: "#fff" }}
          size={Math.max(3, name.length)}
        />
      </div>
    );
  }

  return (
    <>
      <span
        className={cn(
          "group inline-flex items-stretch h-6 rounded-md overflow-hidden text-sm font-medium leading-none",
          active && "ring-1 ring-fg/30"
        )}
      >
        <Link
          href={href}
          onDoubleClick={(e) => { e.preventDefault(); setRenaming(true); }}
          title={`${tag.name} — double-click to rename`}
          className="inline-flex items-center px-2 transition-opacity hover:opacity-90"
          style={{ backgroundColor: tag.color, color: "#fff" }}
        >
          {tag.name}
        </Link>
        <button
          ref={colorBtnRef}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (colorOpen) setColorOpen(false);
            else openColorPicker();
          }}
          aria-label={`Change color of ${tag.name}`}
          title="Change color"
          className="inline-flex items-center justify-center w-5 transition-colors"
          style={{ backgroundColor: tag.color, color: "rgba(255,255,255,0.78)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.78)")}
        >
          <Palette className="size-3" strokeWidth={2.4} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirming(true);
          }}
          aria-label={`Delete ${tag.name}`}
          title="Delete tag"
          className="inline-flex items-center justify-center w-5 transition-colors"
          style={{ backgroundColor: tag.color, color: "rgba(255,255,255,0.78)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.78)")}
        >
          <X className="size-3" strokeWidth={2.5} />
        </button>
      </span>

      {/* Color picker popover */}
      {mounted && colorOpen && colorPos && createPortal(
        <div
          data-tag-color-pop={tag.id}
          className="fixed z-[200] rounded-md border border-border surface-strong shadow-lg p-2 animate-fade-in"
          style={{ top: colorPos.top, left: colorPos.left }}
        >
          <div className="editorial-number text-[9px] mb-1.5">Color</div>
          <div className="flex flex-wrap gap-1.5 max-w-[180px]">
            {TAG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                aria-label={`Set color ${c}`}
                onClick={() => pickColor(c)}
                className={cn(
                  "size-6 rounded-md transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-fg/30 focus:ring-offset-1",
                  c === tag.color && "ring-2 ring-offset-1 ring-fg"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirm modal */}
      {mounted && confirming && createPortal(
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/30 backdrop-blur-sm animate-fade-in px-4"
          onClick={() => setConfirming(false)}
        >
          <div
            className="card surface-strong max-w-md w-full p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h2 className="font-display text-2xl tracking-tight">
                Delete &quot;#{tag.name}&quot;?
              </h2>
              <p className="text-sm text-muted-fg">
                The tag will be removed from every task that uses it. The tasks themselves stay.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                className="btn-ghost h-9 px-4"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn h-9 px-5 bg-danger text-white hover:opacity-90"
                onClick={commitDelete}
                disabled={del.isPending}
              >
                {del.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
