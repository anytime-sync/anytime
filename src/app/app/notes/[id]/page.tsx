"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Note = {
  id: string;
  title: string | null;
  body: string;
  links_to: string[];
  pinned: boolean;
  archived: boolean;
  updated_at: string;
};

export default function NoteEditorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [converting, setConverting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load
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

  // Debounced autosave
  const save = useCallback(async (next: { title?: string; body?: string }) => {
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
  }, [params.id]);

  function onTitleChange(v: string) {
    setTitle(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void save({ title: v }), 600);
  }

  function onBodyChange(v: string) {
    setBody(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void save({ body: v }), 800);
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

  if (!note) return <div className="p-6 text-gray-400">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-3 text-sm text-gray-500">
        <button
          onClick={() => router.push("/app/notes")}
          className="hover:underline"
        >
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
          <button
            onClick={deleteNote}
            className="text-red-600 hover:underline"
          >
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

      <textarea
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder="Write…  Use [[Note Title]] to link to other notes."
        className="w-full min-h-[60vh] bg-transparent outline-none resize-none font-mono text-sm leading-relaxed"
      />

      {note.links_to && note.links_to.length > 0 && (
        <div className="mt-6 pt-4 border-t text-sm">
          <div className="text-gray-500 mb-2">Links to:</div>
          <div className="flex flex-wrap gap-2">
            {note.links_to.map((slug) => (
              <span
                key={slug}
                className="px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs"
              >
                [[{slug}]]
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
