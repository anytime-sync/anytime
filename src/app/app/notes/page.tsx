"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Note = {
  id: string;
  title: string | null;
  body: string;
  pinned: boolean;
  archived: boolean;
  updated_at: string;
};

export default function NotesIndexPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/notes${showArchived ? "?archived=1" : ""}`,
        { cache: "no-store" }
      );
      const j = await res.json();
      setNotes(j.notes ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  async function newNote() {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Untitled note", body: "" }),
    });
    const j = await res.json();
    if (j.note?.id) {
      window.location.href = `/app/notes/${j.note.id}`;
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-serif">Notes</h1>
        <div className="flex gap-2">
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <button
            onClick={newNote}
            className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700"
          >
            + New note
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading…</div>
      ) : notes.length === 0 ? (
        <div className="text-gray-400 text-center py-12">
          No notes yet. Click "New note" to start your second brain.
        </div>
      ) : (
        <ul className="divide-y">
          {notes.map((n) => (
            <li key={n.id}>
              <Link
                href={`/app/notes/${n.id}`}
                className="block py-3 hover:bg-amber-50 rounded px-2"
              >
                <div className="font-medium flex items-center gap-2">
                  {n.pinned && <span title="Pinned">📌</span>}
                  {n.archived && (
                    <span className="text-xs uppercase text-gray-400">
                      Archived
                    </span>
                  )}
                  {n.title || "Untitled"}
                </div>
                <div className="text-sm text-gray-500 line-clamp-2">
                  {n.body.slice(0, 200) || "Empty note"}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(n.updated_at).toLocaleString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
