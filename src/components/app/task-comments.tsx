"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useLanguage } from "@/lib/use-language";
import { t, getLanguage } from "@/lib/i18n";
import {
  useTaskComments,
  useAddComment,
  useUpdateComment,
  useDeleteComment,
  type TaskComment,
} from "@/hooks/use-comments";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Comments section for a task. Lives inside the task detail panel.
 * Plain-text body with a tiny @mention highlighter — no markdown for v1.
 */
export function TaskComments({ taskId }: { taskId: string }) {
  const lang = useLanguage();
  const dfLocale = getLanguage(lang).dateFnsLocale;

  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled) setMeId(user?.id ?? null);
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { data: comments = [], isLoading } = useTaskComments(taskId);
  const add = useAddComment(taskId);
  const update = useUpdateComment(taskId);
  const del = useDeleteComment(taskId);

  const [draft, setDraft] = useState("");
  const trimmed = draft.trim();
  const taRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    if (!trimmed || add.isPending) return;
    add.mutate(trimmed, {
      onSuccess: () => setDraft(""),
    });
  }

  return (
    <div className="space-y-3">
      {isLoading && (
        <p className="text-xs text-muted-fg italic">
          {t(lang, "comments.loading")}
        </p>
      )}

      {!isLoading && comments.length === 0 && (
        <p className="text-xs text-muted-fg italic">
          {t(lang, "comments.empty")}
        </p>
      )}

      {!isLoading && comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              isOwn={!!meId && c.author_id === meId}
              dfLocale={dfLocale}
              onSave={(body) =>
                update.mutate({ commentId: c.id, body })
              }
              onDelete={() => {
                if (window.confirm(t(lang, "comments.deleteConfirm"))) {
                  del.mutate(c.id);
                }
              }}
            />
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <textarea
          ref={taRef}
          rows={3}
          className="input min-h-[72px] py-2 text-sm"
          placeholder={t(lang, "comments.placeholder")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="flex justify-end">
          <button
            disabled={!trimmed || add.isPending}
            onClick={submit}
            className="btn-primary h-8 px-3 text-xs"
          >
            {t(lang, "comments.send")}
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  isOwn,
  dfLocale,
  onSave,
  onDelete,
}: {
  comment: TaskComment;
  isOwn: boolean;
  dfLocale: Locale;
  onSave: (body: string) => void;
  onDelete: () => void;
}) {
  const lang = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(comment.body);
  }, [comment.body]);

  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const display =
    comment.author?.full_name?.trim() ||
    comment.author?.email ||
    "?";
  const initial =
    (display.match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase();

  const created = new Date(comment.created_at);
  const updated = new Date(comment.updated_at);
  const wasEdited = updated.getTime() - created.getTime() > 1000;

  return (
    <li className="group flex gap-2 text-sm">
      {comment.author?.avatar_url ? (
        // Avatar uses raw <img> (the project doesn't ship a wrapper).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={comment.author.avatar_url}
          alt={display}
          className="size-7 rounded-full object-cover shrink-0"
        />
      ) : (
        <span className="size-7 rounded-full bg-accent/20 text-accent text-[12px] font-medium grid place-items-center shrink-0">
          {initial}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{display}</span>
          <span
            className="text-[10px] text-muted-fg"
            title={created.toISOString()}
          >
            {formatDistanceToNow(created, {
              addSuffix: true,
              locale: dfLocale,
            })}
          </span>
          {wasEdited && (
            <span className="text-[10px] text-muted-fg italic">
              ({t(lang, "comments.editedSuffix")})
            </span>
          )}
          {isOwn && !editing && (
            <div ref={menuRef} className="relative ml-auto">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className={cn(
                  "size-6 grid place-items-center rounded text-muted-fg hover:bg-muted",
                  "opacity-0 group-hover:opacity-100 focus:opacity-100",
                  menuOpen && "opacity-100"
                )}
                aria-label={t(lang, "comments.edit")}
              >
                <MoreHorizontal className="size-3.5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-7 z-10 surface-strong border border-border rounded-md shadow-lg overflow-hidden min-w-[120px]">
                  <button
                    onClick={() => {
                      setEditing(true);
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-3 h-8 text-xs hover:bg-muted/60"
                  >
                    {t(lang, "comments.edit")}
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="w-full text-left px-3 h-8 text-xs text-danger hover:bg-muted/60"
                  >
                    {t(lang, "comments.delete")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {editing ? (
          <div className="mt-1 space-y-2">
            <textarea
              autoFocus
              rows={3}
              className="input min-h-[72px] py-2 text-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setEditing(false);
                  setDraft(comment.body);
                } else if (
                  (e.metaKey || e.ctrlKey) &&
                  e.key === "Enter"
                ) {
                  e.preventDefault();
                  if (draft.trim()) {
                    onSave(draft.trim());
                    setEditing(false);
                  }
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setDraft(comment.body);
                }}
                className="btn-ghost h-7 px-2 text-xs"
              >
                {t(lang, "comments.cancel")}
              </button>
              <button
                disabled={!draft.trim()}
                onClick={() => {
                  onSave(draft.trim());
                  setEditing(false);
                }}
                className="btn-primary h-7 px-3 text-xs"
              >
                {t(lang, "comments.save")}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-fg">
            {renderBody(comment.body)}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Plain-text renderer with @mention highlighting. No markdown — keeps
 * the v1 surface area minimal and avoids accidental HTML injection.
 */
function renderBody(body: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /@([\w.+-]+(?:@[\w.+-]+)?)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(body))) {
    if (m.index > last) parts.push(body.slice(last, m.index));
    parts.push(
      <span key={`m-${i++}`} className="text-accent">
        @{m[1]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

// Minimal Locale type alias — date-fns exports it but we keep this
// component import-light by using a local re-declaration.
type Locale = Parameters<typeof formatDistanceToNow>[1] extends
  | { locale?: infer L }
  | undefined
  ? L
  : never;
