"use client";

import { useEffect, useState, useCallback } from "react";
import { Paintbrush, Eye, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Announcement format / color control.
 *
 * Two sections:
 * A) Per-style defaults — preview + override the 4 built-in styles
 * B) Per-announcement — set custom bg/text/border on individual items
 */

type StyleKey = "accent" | "info" | "success" | "warning";

type StyleConfig = {
  bg: string;
  text: string;
  border: string;
};

type Announcement = {
  id: string;
  message: string;
  style: StyleKey;
  active: boolean;
  bg_color: string | null;
  text_color: string | null;
  border_color: string | null;
};

// Tailwind defaults mapped to rough hex so color pickers have starting values
const DEFAULT_STYLES: Record<StyleKey, StyleConfig> = {
  accent:  { bg: "#fdf8f0", text: "#a67c52", border: "#e8d5bd" },
  info:    { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
  success: { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0" },
  warning: { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
};

export default function FormatPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewStyle, setPreviewStyle] = useState<StyleKey>("accent");
  const [previewOverride, setPreviewOverride] = useState<StyleConfig>({ ...DEFAULT_STYLES.accent });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/announcements");
    if (res.ok) setAnnouncements(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveAnnouncementColors(id: string, colors: Partial<StyleConfig & { bg_color: string; text_color: string; border_color: string }>) {
    const res = await fetch(`/api/admin/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bg_color: colors.bg_color ?? colors.bg ?? null,
        text_color: colors.text_color ?? colors.text ?? null,
        border_color: colors.border_color ?? colors.border ?? null,
      }),
    });
    if (res.ok) {
      toast.success("Colors updated");
      load();
    } else {
      toast.error("Failed to save");
    }
  }

  async function clearColors(id: string) {
    await saveAnnouncementColors(id, { bg_color: "", text_color: "", border_color: "" });
  }

  return (
    <div className="px-8 md:px-12 py-12 max-w-6xl">
      <header className="mb-12">
        <p className="editorial-number text-[11px] mb-3">
          The Admin Edition · No. 12
        </p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight leading-[1.05]">
          Format<em className="font-display">, the palette.</em>
        </h1>
        <p className="text-sm text-muted-fg mt-4 italic font-display">
          Control announcement banner colors and visual style.
        </p>
        <div className="mt-8 h-px bg-accent/40 w-24" />
      </header>

      {/* Section A: Style Preview */}
      <section className="mb-16">
        <p className="editorial-number text-[10px] mb-4">Style Preview</p>
        <p className="text-sm text-muted-fg mb-6">
          Preview how each announcement style renders. Use per-announcement colors below to override.
        </p>

        <div className="flex gap-2 mb-6">
          {(["accent", "info", "success", "warning"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setPreviewStyle(s);
                setPreviewOverride({ ...DEFAULT_STYLES[s] });
              }}
              className={cn(
                "px-3 py-1.5 rounded text-xs capitalize border transition-colors",
                previewStyle === s
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted-fg hover:text-fg"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Live preview */}
        <div
          className="border-b px-4 py-2.5 text-sm flex items-center justify-center gap-3 rounded-md mb-6"
          style={{
            backgroundColor: previewOverride.bg,
            color: previewOverride.text,
            borderColor: previewOverride.border,
            borderWidth: "1px",
            borderStyle: "solid",
          }}
        >
          <span>This is a preview of the {previewStyle} announcement style.</span>
          <span className="underline underline-offset-2 font-medium cursor-pointer">
            Learn more
          </span>
          <span className="ml-2 opacity-60 cursor-pointer">✕</span>
        </div>

        {/* Color pickers */}
        <div className="grid grid-cols-3 gap-4">
          <ColorField
            label="Background"
            value={previewOverride.bg}
            onChange={(v) => setPreviewOverride((p) => ({ ...p, bg: v }))}
          />
          <ColorField
            label="Text"
            value={previewOverride.text}
            onChange={(v) => setPreviewOverride((p) => ({ ...p, text: v }))}
          />
          <ColorField
            label="Border"
            value={previewOverride.border}
            onChange={(v) => setPreviewOverride((p) => ({ ...p, border: v }))}
          />
        </div>

        <button
          onClick={() => setPreviewOverride({ ...DEFAULT_STYLES[previewStyle] })}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-fg hover:text-fg"
        >
          <RotateCcw className="size-3" />
          Reset to default
        </button>
      </section>

      {/* Section B: Per-Announcement Colors */}
      <section>
        <p className="editorial-number text-[10px] mb-4">Per-Announcement Colors</p>
        <p className="text-sm text-muted-fg mb-6">
          Override colors on individual announcements. Leave blank to use the style default.
        </p>

        {loading ? (
          <p className="text-sm text-muted-fg italic">Loading…</p>
        ) : announcements.length === 0 ? (
          <p className="text-sm text-muted-fg italic">No announcements yet. Create one first.</p>
        ) : (
          <div className="space-y-6">
            {announcements.map((a) => (
              <AnnouncementColorEditor
                key={a.id}
                announcement={a}
                onSave={(colors) => saveAnnouncementColors(a.id, colors)}
                onClear={() => clearColors(a.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-fg uppercase tracking-wider block mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-border cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 px-3 py-2 rounded-md border border-border bg-bg text-sm font-mono"
        />
      </div>
    </div>
  );
}

function AnnouncementColorEditor({
  announcement: a,
  onSave,
  onClear,
}: {
  announcement: Announcement;
  onSave: (colors: { bg_color: string; text_color: string; border_color: string }) => void;
  onClear: () => void;
}) {
  const defaults = DEFAULT_STYLES[a.style] || DEFAULT_STYLES.accent;
  const [bg, setBg] = useState(a.bg_color || defaults.bg);
  const [text, setText] = useState(a.text_color || defaults.text);
  const [border, setBorder] = useState(a.border_color || defaults.border);
  const hasCustom = a.bg_color || a.text_color || a.border_color;

  return (
    <div className={cn(
      "surface border rounded-lg p-5",
      a.active ? "border-accent/30" : "border-border opacity-70"
    )}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium">{a.message}</p>
          <p className="text-xs text-muted-fg mt-0.5">
            Style: {a.style} · {a.active ? "Active" : "Inactive"}
            {hasCustom && " · Custom colors"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasCustom && (
            <button
              onClick={onClear}
              className="text-xs text-muted-fg hover:text-fg flex items-center gap-1"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Live preview */}
      <div
        className="px-4 py-2.5 text-sm flex items-center justify-center gap-3 rounded-md mb-4"
        style={{
          backgroundColor: bg,
          color: text,
          borderColor: border,
          borderWidth: "1px",
          borderStyle: "solid",
        }}
      >
        <span>{a.message}</span>
        <span className="ml-2 opacity-60">✕</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <ColorField label="Background" value={bg} onChange={setBg} />
        <ColorField label="Text" value={text} onChange={setText} />
        <ColorField label="Border" value={border} onChange={setBorder} />
      </div>

      <button
        onClick={() => onSave({ bg_color: bg, text_color: text, border_color: border })}
        className="mt-4 px-4 py-2 rounded-md bg-accent text-white text-sm hover:bg-accent/90"
      >
        Save Colors
      </button>
    </div>
  );
}
