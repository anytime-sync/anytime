"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Languages, Check } from "lucide-react";
import {
  LANGUAGES,
  getLanguage,
  readStoredLanguage,
  writeStoredLanguage,
  t,
  type LanguageCode,
} from "@/lib/i18n";
import { useUserPrefs, useUpdatePrefs } from "@/hooks/use-ai";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * LanguagePicker — works both inside the authed app (reads/writes
 * user_preferences.language) and on pre-login pages (reads/writes
 * localStorage). Pass `mode="local"` for pre-auth pages.
 *
 * Menu opens UPWARD when the trigger sits in the bottom half of the
 * viewport, otherwise downward. Clamped to the viewport on both axes.
 */
export function LanguagePicker({
  mode = "user",
  onChange,
}: {
  mode?: "user" | "local";
  onChange?: (code: LanguageCode) => void;
}) {
  // Authed: read/write Supabase. Pre-auth: read/write localStorage.
  const { data: prefs } = useUserPrefs();
  const update = useUpdatePrefs();
  const qc = useQueryClient();

  const [localLang, setLocalLang] = useState<LanguageCode>("en");
  useEffect(() => {
    if (mode === "local") setLocalLang(readStoredLanguage());
  }, [mode]);

  const currentCode: LanguageCode =
    mode === "local"
      ? localLang
      : ((prefs?.language ?? "en") as LanguageCode);
  const current = getLanguage(currentCode);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function openMenu(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 200;
    const menuHeight = 240;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const openUpward = rect.top + menuHeight + 16 > viewportH;
    let left = rect.left;
    if (left + menuWidth > viewportW - 8) left = viewportW - menuWidth - 8;
    if (left < 8) left = 8;
    setPos(
      openUpward
        ? { bottom: viewportH - rect.top + 6, left }
        : { top: rect.bottom + 6, left }
    );
    setOpen(true);
  }

  async function pick(code: LanguageCode) {
    setOpen(false);
    if (code === currentCode) return;
    if (mode === "local") {
      writeStoredLanguage(code);
      setLocalLang(code);
      onChange?.(code);
      toast.success(t(code, "auth.shared.language") + " — " + getLanguage(code).displayName);
      return;
    }
    try {
      await update.mutateAsync({ language: code });
      writeStoredLanguage(code);
      qc.invalidateQueries({ queryKey: ["dailyEdition"] });
      qc.invalidateQueries({ queryKey: ["weeklyRetro"] });
      onChange?.(code);
      toast.success(`${getLanguage(code).displayName}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't change language");
    }
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t2 = e.target as HTMLElement;
      if (!t2.closest("[data-lang-menu]") && !t2.closest("[data-lang-trigger]")) {
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
          className="fixed z-[200] min-w-[200px] rounded-md border border-border surface-strong shadow-lg p-1 text-sm animate-fade-in"
          style={{ ...(pos as any) }}
        >
          <div className="editorial-number text-[9px] px-2 py-1.5">
            {t(currentCode, "auth.shared.language")}
          </div>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => pick(l.code)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-fg"
            >
              <span className="flex-1 text-left">{l.displayName}</span>
              {l.code === currentCode && <Check className="size-3.5 text-accent" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
