"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useCreateProject } from "@/hooks/use-projects";
import { toast } from "sonner";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";

// Brand-aligned palette: muted, warm where possible. Slightly desaturated
// versions of the primary spectrum so list dots don't shout against the
// First Light photo bg.
const COLORS = [
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

export function CreateProjectDialog({ onClose }: { onClose: () => void }) {
  const lang = useLanguage();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [mounted, setMounted] = useState(false);
  const create = useCreateProject();

  useEffect(() => {
    setMounted(true);
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await create.mutateAsync({ name: trimmed, color });
      toast.success(t(lang, "createProject.toastCreated").replace("{name}", trimmed));
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? t(lang, "createProject.errCreate"));
    }
  }

  // Portal to document.body to escape any ancestor with backdrop-filter
  // (e.g. the sidebar's .surface class), which creates a containing
  // block and breaks position:fixed centering.
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="card surface-strong w-[90vw] max-w-md p-6 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <h3 className="font-display text-2xl tracking-tight">{t(lang, "createProject.title")}</h3>
          <p className="text-xs text-muted-fg">{t(lang, "createProject.intro")}</p>
        </div>

        <input
          autoFocus
          className="input h-11 text-base"
          placeholder={t(lang, "createProject.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />

        <div>
          <div className="editorial-number text-[10px] mb-2">{t(lang, "createProject.colorLabel")}</div>
          <div className="flex flex-wrap gap-2.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setColor(c)}
                className="size-6 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: color === c ? "2px solid hsl(var(--fg))" : "none",
                  outlineOffset: "2px",
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost h-9 px-4" onClick={onClose}>
            {t(lang, "createProject.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary h-9 px-5"
            disabled={!name.trim() || create.isPending}
            onClick={submit}
          >
            {create.isPending ? t(lang, "createProject.creating") : t(lang, "createProject.create")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
