"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n";
import { Save, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Admin Content CMS
 *
 * Full editor for every translatable string in the app. The default
 * value (left column) is the hardcoded fallback from src/lib/i18n.ts —
 * read here through dynamic import so we don't have to maintain a
 * second source of truth. The right column is the editable override
 * stored in `site_content`. Save writes one row per (locale, key);
 * "Restore" deletes the row and the app falls back to the hardcoded
 * default on next render.
 *
 * Strings are grouped by their dotted prefix (landing.* / sidebar.* /
 * view.* / etc.) so the page reads like a structured manifest.
 */

type StringRow = {
  key: string;
  defaultValue: string;
  override: string | null;
  /** Original override loaded from the DB — used to detect dirty rows. */
  pristine: string | null;
};

export default function ContentPage() {
  const [locale, setLocale] = useState<LanguageCode>("en");
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<StringRow[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load the hardcoded defaults for the chosen locale.
  useEffect(() => {
    (async () => {
      setLoading(true);
      const i18n = await import("@/lib/i18n");
      const langDef = i18n.LANGUAGES.find((l) => l.code === locale);
      if (!langDef) return;
      // Each language file is a `Record<TranslationKey, string>`. The
      // module exports them as named consts (enUS, zhTW, etc.) — we
      // pluck the right one based on the locale code.
      const map = i18n.getTranslations(locale) as Record<string, string>;
      setDefaults(map);

      // Pull existing overrides for this locale.
      const supabase = createClient();
      const { data } = await supabase
        .from("site_content")
        .select("key, value")
        .eq("locale", locale);

      const overrides = new Map<string, string>(
        (data ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
      );

      const newRows: StringRow[] = Object.entries(map).map(([k, v]) => ({
        key: k,
        defaultValue: v,
        override: overrides.get(k) ?? null,
        pristine: overrides.get(k) ?? null,
      }));
      setRows(newRows);
      setLoading(false);
    })();
  }, [locale]);

  // Group keys by section (everything before the first dot).
  const grouped = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.key.toLowerCase().includes(q) ||
        r.defaultValue.toLowerCase().includes(q) ||
        (r.override ?? "").toLowerCase().includes(q)
      );
    });
    const groups: Record<string, StringRow[]> = {};
    for (const r of filtered) {
      const section = r.key.split(".")[0] ?? "other";
      if (!groups[section]) groups[section] = [];
      groups[section]!.push(r);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, search]);

  function setOverride(key: string, value: string) {
    setRows((rs) =>
      rs.map((r) => (r.key === key ? { ...r, override: value } : r))
    );
  }

  async function save(row: StringRow) {
    setSaving(row.key);
    const supabase = createClient();
    const value = (row.override ?? "").trim();
    if (!value) {
      // Empty override = delete (revert to default).
      await supabase
        .from("site_content")
        .delete()
        .eq("locale", locale)
        .eq("key", row.key);
      setRows((rs) =>
        rs.map((r) =>
          r.key === row.key ? { ...r, override: null, pristine: null } : r
        )
      );
    } else {
      await supabase.from("site_content").upsert({
        locale,
        key: row.key,
        value,
        updated_at: new Date().toISOString(),
      });
      setRows((rs) =>
        rs.map((r) =>
          r.key === row.key ? { ...r, pristine: value } : r
        )
      );
    }
    setSaving(null);
  }

  async function restore(row: StringRow) {
    setSaving(row.key);
    const supabase = createClient();
    await supabase
      .from("site_content")
      .delete()
      .eq("locale", locale)
      .eq("key", row.key);
    setRows((rs) =>
      rs.map((r) =>
        r.key === row.key ? { ...r, override: null, pristine: null } : r
      )
    );
    setSaving(null);
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl">
      <header className="mb-6">
        <p className="editorial-number text-xs mb-1">Admin</p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight">
          Content
        </h1>
        <p className="text-sm text-muted-fg mt-1">
          Edit every translatable string per language. Empty overrides fall
          back to the hardcoded defaults.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLocale(l.code)}
              className={cn(
                "px-3 h-8 whitespace-nowrap",
                locale === l.code
                  ? "bg-fg text-bg"
                  : "btn-ghost rounded-none"
              )}
            >
              {l.displayName}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="size-4 text-muted-fg absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keys or text…"
            className="input w-full pl-8"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-fg">Loading strings…</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([section, items]) => (
            <section key={section}>
              <p className="editorial-number text-[10px] mb-2">{section}</p>
              <div className="surface border border-border rounded-lg divide-y divide-border">
                {items.map((row) => {
                  const dirty =
                    (row.override ?? "") !== (row.pristine ?? "");
                  const overridden = row.pristine != null;
                  return (
                    <div key={row.key} className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] font-mono text-muted-fg">
                          {row.key}
                        </code>
                        {overridden && (
                          <span className="text-[10px] uppercase tracking-wider text-accent">
                            · overridden
                          </span>
                        )}
                      </div>
                      <div className="grid md:grid-cols-2 gap-2">
                        <div className="text-xs text-muted-fg p-2 bg-muted/40 rounded leading-relaxed">
                          {row.defaultValue}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <textarea
                            value={row.override ?? ""}
                            onChange={(e) => setOverride(row.key, e.target.value)}
                            placeholder="(uses default)"
                            rows={Math.max(
                              1,
                              Math.ceil(row.defaultValue.length / 60)
                            )}
                            className="input text-sm leading-relaxed resize-y min-h-[34px]"
                          />
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              onClick={() => save(row)}
                              disabled={!dirty || saving === row.key}
                              className={cn(
                                "btn-ghost px-2 h-7 inline-flex items-center gap-1.5",
                                dirty &&
                                  "text-fg hover:bg-accent/10",
                                !dirty && "opacity-40 cursor-not-allowed"
                              )}
                            >
                              <Save className="size-3" />
                              {saving === row.key ? "Saving…" : "Save"}
                            </button>
                            {overridden && (
                              <button
                                onClick={() => restore(row)}
                                disabled={saving === row.key}
                                className="btn-ghost px-2 h-7 inline-flex items-center gap-1.5 text-muted-fg"
                              >
                                <RotateCcw className="size-3" />
                                Restore default
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {grouped.length === 0 && (
            <p className="text-sm text-muted-fg">No matches.</p>
          )}
        </div>
      )}
    </div>
  );
}
