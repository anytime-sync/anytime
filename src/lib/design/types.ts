/**
 * Per-element design overrides written by the /admin/design editor.
 * Style is shared across locales; per-locale TEXT overrides live in
 * the existing site_content table.
 *
 * Floating elements (created via the editor's "+ Text" button) live
 * in the same table. They are identified by `_kind: 'floating'` and
 * carry their own page binding, text, and absolute coordinates.
 *
 * Per-mode (day / night): every visual field below also lives under
 * an optional `night` sub-object. At render time, when the user is
 * in dark mode the night value wins per-key, falling back to the
 * top-level (day) value if absent. So existing rows keep working
 * unchanged — the night sub-object is purely additive.
 */
export type StyleFields = {
  // --- Typography ---
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: "normal" | "italic";
  letterSpacing?: string;
  lineHeight?: string;
  color?: string;
  textAlign?: "left" | "center" | "right";

  // --- Transform / position nudge ---
  translateX?: number;
  translateY?: number;
  scale?: number;
  rotate?: number;
  opacity?: number;

  // --- Background image ---
  bgImageUrl?: string | null;
  bgPosition?: string;
  bgSize?: string;

  // --- Dimensions ---
  width?: string;
  height?: string;
};

export type DesignOverrides = StyleFields & {
  /**
   * Per-night-mode style overrides. Resolved with day-fallback at
   * render time: the night value wins when the user is in dark mode,
   * but any field left unset falls back to the top-level (day) value.
   */
  night?: StyleFields;

  /**
   * Per-language style overrides. Each entry can also nest a `night`
   * sub-object for per-language-AND-dark-mode tweaks.
   *
   * Resolution precedence (per field, last one wins):
   *   1. top-level (baseline / English)
   *   2. top-level `night` (when isDark)
   *   3. langs[lang]
   *   4. langs[lang].night (when isDark)
   *
   * English is the implicit baseline — we don't store anything under
   * `langs.en`. Existing rows without `langs` keep rendering identically.
   */
  langs?: Record<string, StyleFields & { night?: StyleFields }>;

  // --- Visibility ---
  hidden?: boolean;

  // --- Floating-element fields (only present on `_kind: 'floating'`) ---
  _kind?: "floating";
  _page?: string;
  /** Baseline text (English fallback when no per-locale entry exists). */
  _text?: string;
  /** Per-locale text overrides, keyed by language code (en, zh-TW, ...). */
  _texts?: Record<string, string>;
  /** Absolute position in pixels from the document's top-left corner. */
  _x?: number;
  _y?: number;
};

export type DesignMap = Record<string, DesignOverrides>;

export type SlotMeta = {
  id: string;
  label: string;
  page: string;
};
