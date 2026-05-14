"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Note editor.
 *
 * Body textarea supports `[[Wiki Link]]` references:
 *   - Type `[[` and an autocomplete popover lists your other notes.
 *   - ↑↓ to highlight, Enter or click to insert `[[Title]]`, Esc to cancel.
 *   - Saved links are parsed server-side (see `parseLinks` in lib/notes.ts)
 *     and listed at the bottom of the editor as clickable chips.
 *
 * Embeddings sync automatically on save (see /api/notes routes), so notes
 * become discoverable via semantic search within ~1s of saving.
 */

type Note = {
  id: string;
  title: string | null;
  body: string;
  links_to: string[];
  pinned: boolean;
  archived: boolean;
  updated_at: string;
};

type NoteSummary = { id: string; title: string | null };

/** Look back from the caret for an open `[[` without a matching `]]` or newline. */
function detectWikiTrigger(body: string, caret: number) {
  const before = body.slice(0, caret);
  const lastOpen = before.lastIndexOf("[[");
  if (lastOpen === -1) return null;
  const between = before.slice(lastOpen + 2);
  if (/[\]\n]/.test(between)) return null;
  if (between.length > 60) return null;
  return { startIdx: lastOpen, query: between };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export default function NoteEditorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [converting, setConverting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Autocomplete state ──────────────────────────────────────────────
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [allNotes, setAllNotes] = useState<NoteSummary[]>([]);
  const [acOpen, setAcOpen] = useState(false);
  const [acQuery, setAcQuery] = useState("");
  const [acStart, setAcStart] = useState(-1);
  const [acHighlight, setAcHighlight] = useState(0);

  // Pull all the user's notes once on mount for the autocomplete index.
  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/notes", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      setAllNotes(((j.notes ?? []) as NoteSummary[]).map((n) => ({ id: n.id, title: n.title })));
    })();
  }, []);

  // Initial load of the current note.
  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/notes/${params.id}`, { cache: "no-store" });
      if (!res.ok) {
        router.push("/app/notes");
        return;
      }
      const j = await res.json();
      setNote(j.note);
      setTitle(j.note.title ?? "");
      setBody(j.note.body ?? "");
    })();
  }, [params.id, router]);

  // Debounced autosave.
  const save = useCallback(
    async (next: { title?: string; body?: string }) => {
      setSaving(true);
      try {
        await fetch(`/api/notes/${params.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(next),
        });
        setSavedAt(new Date().toLocaleTimeString());
      } finally {
        setSaving(false);
      }
    },
    [params.id]
  );

  function onTitleChange(v: string) {
    setTitle(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void save({ title: v }), 600);
  }

  function recomputeAutocomplete(nextBody: string, caret: number) {
    const trigger = detectWikiTrigger(nextBody, caret);
    if (!trigger) {
      setAcOpen(false);
      return;
    }
    setAcOpen(true);
    setAcQuery(trigger.query);
    setAcStart(trigger.startIdx);
    setAcHighlight(0);
  }

  function onBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setBody(v);
    recomputeAutocomplete(v, e.target.selectionStart);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void save({ body: v }), 800);
  }

  // Filter notes by the active query (prefix match, then includes).
  const acResults = useMemo<NoteSummary[]>(() => {
    if (!acOpen) return [];
    const q = acQuery.toLowerCase();
    const others = allNotes.filter((n) => n.id !== params.id);
    if (q.length === 0) return others.slice(0, 6);
    const starts: NoteSummary[] = [];
    const contains: NoteSummary[] = [];
    for (const n of others) {
      const t = (n.title ?? "Untitled").toLowerCase();
      if (t.startsWith(q)) starts.push(n);
      else if (t.includes(q)) contains.push(n);
    }
    return [...starts, ...contains].slice(0, 6);
  }, [acOpen, acQuery, allNotes, params.id]);

  function applyPick(pick: NoteSummary) {
    const ta = textareaRef.current;
    if (!ta || acStart < 0) return;
    const insertTitle = pick.title ?? "Untitled";
    const caret = ta.selectionStart;
    // Replace from `[[` start through current caret with `[[Title]]`.
    const before = body.slice(0, acStart);
    const after = body.slice(caret);
    const inserted = `[[${insertTitle}]]`;
    const next = before + inserted + after;
    setBody(next);
    setAcOpen(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void save({ body: next }), 300);
    // Restore caret just after the inserted `]]`.
    const newCaret = before.length + inserted.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCaret, newCaret);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!acOpen || acResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAcHighlight((i) => (i + 1) % acResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAcHighlight((i) => (i - 1 + acResults.length) % acResults.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      applyPick(acResults[acHighlight] ?? acResults[0]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAcOpen(false);
    }
  }

  async function convertToTask() {
    if (converting) return;
    setConverting(true);
    try {
      const r = await fetch(`/api/notes/${params.id}/convert-to-task`, { method: "POST" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert("Couldn't convert: " + (j.error ?? r.status));
        return;
      }
      router.push("/app/today");
    } finally {
      setConverting(false);
    }
  }

  async function deleteNote() {
    if (!confirm("Delete this note? This can't be undone.")) return;
    await fetch(`/api/notes/${params.id}`, { method: "DELETE" });
    router.push("/app/notes");
  }

  // Resolve slug → note for the bottom "Links to" chips.
  const linksToWithTitles = useMemo(() => {
    if (!note?.links_to) return [];
    return note.links_to.map((slug) => {
      const match = allNotes.find((n) => slugify(n.title ?? "Untitled") === slug);
      return { slug, note: match };
    });
  }, [note?.links_to, allNotes]);

  if (!note) return <div className="p-6 text-gray-400">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-3 text-sm text-gray-500">
        <button onClick={() => router.push("/app/notes")} className="hover:underline">
          ← All notes
        </button>
        <div className="flex items-center gap-3">
          <span>{saving ? "Saving…" : savedAt ? `Saved ${savedAt}` : ""}</span>
          <button
            onClick={convertToTask}
            disabled={converting}
            className="text-xs px-2 py-1 rounded hover:bg-muted/40 disabled:opacity-50"
            title="Create a task from this note"
          >
            {converting ? "Converting…" : "Convert to task"}
          </button>
          <button onClick={deleteNote} className="text-red-600 hover:underline">
            Delete
          </button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Untitled"
        className="w-full text-3xl font-serif bg-transparent outline-none mb-4"
      />

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={onBodyChange}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setAcOpen(false), 120)}
          placeholder="Write… Type [[ to link another note."
          className="w-full min-h-[60vh] bg-transparent outline-none resize-none font-mono text-sm leading-relaxed"
        />

        {acOpen && acResults.length > 0 && (
          <div
            className="absolute right-0 top-0 mt-1 w-64 max-h-64 overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg z-10"
            role="listbox"
          >
            <div className="px-3 py-1.5 text-[10px] tracking-[0.18em] text-stone-400 uppercase border-b border-stone-100">
              Link a note · {acResults.length} match{acResults.length === 1 ? "" : "es"}
            </div>
            {acResults.map((r, i) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={i === acHighlight}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyPick(r);
                }}
                onMouseEnter={() => setAcHighlight(i)}
                className={
                  "w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 " +
                  (i === acHighlight ? "bg-amber-50" : "hover:bg-stone-50")
                }
              >
                <span className="text-amber-700 text-xs shrink-0">[[</span>
                <span className="truncate">{r.title ?? "Untitled"}</span>
              </button>
            ))}
            <div className="px-3 py-1.5 text-[10px] text-stone-400 border-t border-stone-100">
              ↑↓ to navigate · Enter to insert · Esc to cancel
            </div>
          </div>
        )}
      </div>

      {linksToWithTitles.length > 0 && (
        <div className="mt-6 pt-4 border-t text-sm">
          <div className="text-gray-500 mb-2">Links to:</div>
          <div className="flex flex-wrap gap-2">
            {linksToWithTitles.map(({ slug, note: target }) =>
              target ? (
                <Link
                  key={slug}
                  href={`/app/notes/${target.id}`}
                  className="px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs hover:bg-amber-100 transition-colors"
                >
                  [[{target.title ?? "Untitled"}]]
                </Link>
              ) : (
                <span
                  key={slug}
                  className="px-2 py-1 bg-stone-50 border border-stone-200 rounded text-xs text-stone-500 italic"
                  title="No note matches this slug yet"
                >
                  [[{slug}]] · unresolved
                </span>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
