"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tag } from "@/lib/db.types";
import { useRenameTag, useDeleteTag } from "@/hooks/use-tags";
import { toast } from "sonner";

/**
 * SidebarTagItem — a compact, inline tag pill.
 *
 * Layout:
 *   - The pill is a flex-row: a clickable Link (navigates to the tag
 *     view) followed by an X button (deletes the tag globally after
 *     confirmation).
 *   - Width is content-driven; pills wrap onto the next row when the
 *     parent's flex-wrap container fills.
 *   - Background = tag.color. Text color is auto-picked for contrast
 *     so any user-chosen color stays readable.
 *   - Double-click swaps the pill into an inline rename input.
 *
 * The delete-confirm modal is portaled to <body> (the sidebar's
 * backdrop-filter would otherwise break position:fixed centering).
 */
export function SidebarTagItem({
  tag,
  active,
}: {
  tag: Tag;
  active: boolean;
}) {
  const rename = useRenameTag();
  const del = useDeleteTag();
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(tag.name);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const href = `/app/tags/${encodeURIComponent(tag.name)}`;

  useEffect(() => setMounted(true), []);
  useEffect(() => setName(tag.name), [tag.name]);
  useEffect(() => {
    if (renaming) setTimeout(() => inputRef.current?.select(), 10);
  }, [renaming]);

  const fg = readableTextColor(tag.color);
  const subtleFg = fg === "#fff" ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.55)";

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

  if (renaming) {
    return (
      <div
        className="inline-flex items-center h-6 rounded-md px-1.5 text-[11px] font-medium"
        style={{ backgroundColor: tag.color, color: fg }}
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
          style={{ color: fg }}
          size={Math.max(3, name.length)}
        />
      </div>
    );
  }

  return (
    <>
      <span className="group inline-flex items-stretch h-6 rounded-md overflow-hidden text-[11px] font-medium leading-none">
        <Link
          href={href}
          onDoubleClick={(e) => { e.preventDefault(); setRenaming(true); }}
          title={`${tag.name} — double-click to rename`}
          className={cn(
            "inline-flex items-center px-2 transition-opacity hover:opacity-90",
            active && "ring-1 ring-fg/30"
          )}
          style={{
            backgroundColor: tag.color,
            color: fg,
          }}
        >
          {tag.name}
        </Link>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirming(true);
          }}
          aria-label={`Delete #${tag.name}`}
          title={`Delete #${tag.name}`}
          className="inline-flex items-center justify-center w-5 transition-colors"
          style={{
            backgroundColor: tag.color,
            color: subtleFg,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = fg;
            e.currentTarget.style.backgroundColor = darken(tag.color, 0.12);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = subtleFg;
            e.currentTarget.style.backgroundColor = tag.color;
          }}
        >
          <X className="size-3" strokeWidth={2.5} />
        </button>
      </span>

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

/* ---------- helpers ---------- */

/** Pick white or charcoal text based on the bg color's perceived brightness. */
function readableTextColor(hex: string): "#fff" | "#111" {
  const { r, g, b } = parseHex(hex);
  // Relative luminance (Rec. 709 approximation).
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.62 ? "#111" : "#fff";
}

/** Darken a hex color by a factor (0-1). Used for the X button's hover. */
function darken(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  const f = (n: number) => Math.max(0, Math.min(255, Math.round(n * (1 - amount))));
  return rgbToHex(f(r), f(g), f(b));
}

function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2) || "0", 16);
  const g = parseInt(h.slice(2, 4) || "0", 16);
  const b = parseInt(h.slice(4, 6) || "0", 16);
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  const t = (n: number) => n.toString(16).padStart(2, "0");
  return `#${t(r)}${t(g)}${t(b)}`;
}
