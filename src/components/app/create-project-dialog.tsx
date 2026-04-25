"use client";

import { useEffect, useState } from "react";
import { useCreateProject } from "@/hooks/use-projects";

const COLORS = [
  "#4772fa", "#22c55e", "#ef4444", "#f97316", "#eab308",
  "#14b8a6", "#a855f7", "#ec4899", "#64748b",
];

export function CreateProjectDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const create = useCreateProject();

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        className="card w-[90vw] max-w-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold">New list</h3>
        <input
          autoFocus
          className="input"
          placeholder="List name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`size-7 rounded-full ${color === c ? "ring-2 ring-offset-2 ring-offset-panel ring-fg" : ""}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              aria-label={c}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!name.trim() || create.isPending}
            onClick={async () => {
              await create.mutateAsync({ name: name.trim(), color });
              onClose();
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
