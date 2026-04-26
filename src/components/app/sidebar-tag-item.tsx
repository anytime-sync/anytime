"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Hash, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tag } from "@/lib/db.types";
import { useRenameTag, useDeleteTag } from "@/hooks/use-tags";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";
import { toast } from "sonner";

/**
 * One row in the sidebar Tags section. Mirrors SidebarListItem:
 *   - The ⋯ button is a sibling of <Link>, not a child, so Next.js
 *     Link click-through can't swallow the button click.
 *   - Menu and confirm modal portaled to body to escape the sidebar's
 *     backdrop-filter (which would otherwise create a containing block
 *     that breaks position:fixed).
 */
export function SidebarTagItem({
  tag,
  active,
}: {
  tag: Tag;
  active: boolean;
}) {
  const lang = useLanguage();
  const rename = useRenameTag();
  const del = useDeleteTag();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(tag.name);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const href = `/app/tags/${encodeURIComponent(tag.name)}`;

  useEffect(() => setMounted(true), []);
  useEffect(() => setName(tag.name), [tag.name]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      const inside = wrapRef.current?.contains(target);
      const inPortal =
        target instanceof HTMLElement &&
        target.closest(`[data-tag-menu="${tag.id}"]`);
      if (!inside && !inPortal) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [tag.id]);

  useEffect(() => {
    if (renaming) setTimeout(() => inputRef.current?.select(), 10);
  }, [renaming]);

  function openMenu() {
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setMenuOpen(true);
  }

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
      <div className="flex items-center gap-2 h-9 px-2 rounded-md bg-muted">
        <Hash className="size-4 shrink-0" style={{ color: tag.color }} />
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            else if (e.key === "Escape") { setName(tag.name); setRenaming(false); }
          }}
          onBlur={commitRename}
          className="flex-1 bg-transparent outline-none text-sm"
        />
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative group">
      <Link
        href={href}
        className={cn(
          "flex items-center gap-2 h-9 pl-2 pr-8 rounded-md text-sm",
          active ? "bg-muted text-fg" : "text-muted-fg hover:bg-muted hover:text-fg"
        )}
      >
        <Hash className="size-4 shrink-0" style={{ color: tag.color }} />
        <span className="truncate flex-1">{tag.name}</span>
      </Link>

      <button
        ref={menuBtnRef}
        type="button"
        aria-label={`Options for #${tag.name}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (menuOpen) setMenuOpen(false);
          else openMenu();
        }}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 right-1 size-6 grid place-items-center rounded transition",
          "opacity-0 group-hover:opacity-100 hover:bg-bg",
          menuOpen && "opacity-100 bg-bg"
        )}
      >
        <MoreHorizontal className="size-3.5" />
      </button>

      {mounted && menuOpen && menuPos && createPortal(
        <div
          data-tag-menu={tag.id}
          className="fixed z-[90] min-w-[160px] rounded-md border border-border surface-strong shadow-lg p-1 text-sm animate-fade-in"
          style={{ top: menuPos.top, right: menuPos.right }}
        >
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-fg"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(false);
              setRenaming(true);
            }}
          >
            <Pencil className="size-3.5" />
            Rename
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-danger/10 text-danger"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(false);
              setConfirming(true);
            }}
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        </div>,
        document.body
      )}

      {mounted && confirming && createPortal(
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/30 backdrop-blur-sm animate-fade-in"
          onClick={() => setConfirming(false)}
        >
          <div
            className="card surface-strong max-w-md w-[92vw] p-6 space-y-4 shadow-2xl"
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
    </div>
  );
}
