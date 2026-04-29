/**
 * Per-element design overrides written by the /admin/design editor.
 *
 * Day-mode style is stored at the top level of DesignOverrides.
 * Night-mode overrides live in the optional `night` sub-object below;
 * any field unset there falls back to the matching top-level day
 * value, which itself falls back to the Tailwind/component default.
 *
 * This shape stays backward-compatible: existing rows without a
 * `night` block continue to render the same value in both modes,
 * exactly as they always have. The editor now scopes new edits to
 * the active Day/Night tab.
 *
 * Floating elements (created via the editor's "+ Text" button) use
 * the same DesignOverrides shape but add `_kind: 'floating'` and
 * carry their own page binding, text, and absolute coordinates.
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

  // --- Background image (light/day mode) ---
  bgImageUrl?: string | null;
  bgPosition?: string;
  bgSize?: string;

  // --- Element dimensions ---
  width?: string;
  height?: string;
};

export type DesignOverrides = StyleFields & {
  /**
   * Per-mode override block. When the runtime detects dark theme
   * (`.dark` class or `.fl-night-preview` editor marker), each style
   * field falls through `night.X ?? X ?? <Tailwind default>`.
   */
  night?: StyleFields;

  // --- Legacy day/night bg image fields (predate `night`) ---
  // Kept for backward-compat with rows already saved with these keys;
  // `night.bgImageUrl` (etc.) takes precedence when both are present.
  bgImageUrlDark?: string | null;
  bgPositionDark?: string;
  bgSizeDark?: string;

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
