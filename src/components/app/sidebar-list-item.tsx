"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Folder, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/db.types";
import { useUpdateProject, useDeleteProject } from "@/hooks/use-projects";
import { toast } from "sonner";

/**
 * One row in the sidebar Lists section. Shows a ⋯ button on hover.
 *
 * IMPORTANT: the ⋯ button is a SIBLING of the <Link>, not a child.
 * Putting it inside the Link caused click-through navigation in
 * Next.js — preventDefault doesn't reliably stop Link's intercept.
 */
export function SidebarListItem({
  project,
  active,
}: {
  project: Project;
  active: boolean;
}) {
  const update = useUpdateProject();
  const del = useDeleteProject();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const href = `/app/lists/${project.id}`;

  useEffect(() => setName(project.name), [project.name]);

  // Close menu on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Focus the input when entering rename mode.
  useEffect(() => {
    if (renaming) setTimeout(() => inputRef.current?.select(), 10);
  }, [renaming]);

  function commitRename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === project.name) {
      setRenaming(false);
      setName(project.name);
      return;
    }
    update.mutate(
      { id: project.id, name: trimmed },
      {
        onError: (e: any) => toast.error(e?.message ?? "Couldn't rename"),
        onSuccess: () => toast.success("Renamed"),
      }
    );
    setRenaming(false);
  }

  async function commitDelete() {
    try {
      await del.mutateAsync(project.id);
      toast.success(`"${project.name}" deleted`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't delete");
    } finally {
      setConfirming(false);
    }
  }

  if (renaming) {
    return (
      <div className="flex items-center gap-2 h-9 px-2 rounded-md bg-muted">
        <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            else if (e.key === "Escape") { setName(project.name); setRenaming(false); }
          }}
          onBlur={commitRename}
          className="flex-1 bg-transparent outline-none text-sm"
        />
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative group">
      {/* The clickable row — Link only wraps the visual content, NOT the menu button. */}
      <Link
        href={href}
        className={cn(
          "flex items-center gap-2 h-9 pl-2 pr-8 rounded-md text-sm",
          active ? "bg-muted text-fg" : "text-muted-fg hover:bg-muted hover:text-fg"
        )}
      >
        <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
        <Folder className="size-4 shrink-0 text-muted-fg" />
        <span className="truncate flex-1">{project.name}</span>
      </Link>

      {/* ⋯ menu button — sibling of Link, absolutely positioned over the right edge. */}
      <button
        type="button"
        aria-label={`Options for ${project.name}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 right-1 size-6 grid place-items-center rounded transition",
          "opacity-0 group-hover:opacity-100 hover:bg-bg",
          menuOpen && "opacity-100 bg-bg"
        )}
      >
        <MoreHorizontal className="size-3.5" />
      </button>

      {menuOpen && (
        <div className="absolute z-30 right-1 top-9 min-w-[140px] rounded-md border border-border surface shadow-md p-1 text-sm">
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted"
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
        </div>
      )}

      {confirming && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 animate-fade-in"
          onClick={() => setConfirming(false)}
        >
          <div
            className="card max-w-sm w-[92vw] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg mb-1">Delete &quot;{project.name}&quot;?</h2>
            <p className="text-sm text-muted-fg mb-4">
              The list and every task inside will be removed. This can&apos;t be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="btn-ghost h-9 px-3 text-sm"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary h-9 px-3 text-sm bg-danger hover:bg-danger/90"
                onClick={commitDelete}
                disabled={del.isPending}
              >
                {del.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
