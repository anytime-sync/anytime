"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Languages, Check } from "lucide-react";
import { LANGUAGES, getLanguage, type LanguageCode } from "@/lib/i18n";
import { useUserPrefs, useUpdatePrefs } from "@/hooks/use-ai";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Compact language picker that lives in the sidebar footer next to the
 * theme toggle. Reads + writes user_preferences.language. After saving
 * we invalidate the dailyEdition / weekly retro queries so they
 * regenerate in the new language.
 */
export function LanguagePicker() {
  const { data: prefs } = useUserPrefs();
  const update = useUpdatePrefs();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = getLanguage(prefs?.language);

  function openMenu(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({ top: rect.top - 8, left: rect.right + 8 });
    setOpen(true);
  }

  async function pick(code: LanguageCode) {
    setOpen(false);
    if (code === prefs?.language) return;
    try {
      await update.mutateAsync({ language: code });
      // Invalidate AI-cached queries so the brief/retro regenerates.
      qc.invalidateQueries({ queryKey: ["dailyEdition"] });
      qc.invalidateQueries({ queryKey: ["weeklyRetro"] });
      toast.success(`Language set to ${getLanguage(code).displayName}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't change language");
    }
  }

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-lang-menu]") && !t.closest("[data-lang-trigger]")) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <>
      <button
        data-lang-trigger
        type="button"
        onClick={openMenu}
        className="btn-ghost size-9 p-0 grid place-items-center"
        title={`Language — ${current.displayName}`}
        aria-label="Choose language"
      >
        <Languages className="size-4" />
      </button>

      {mounted && open && pos && createPortal(
        <div
          data-lang-menu
          className="fixed z-[90] min-w-[180px] rounded-md border border-border surface-strong shadow-lg p-1 text-sm animate-fade-in"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="editorial-number text-[9px] px-2 py-1.5">Language</div>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => pick(l.code)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-fg"
            >
              <span className="flex-1 text-left">{l.displayName}</span>
              {l.code === current.code && <Check className="size-3.5 text-accent" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
