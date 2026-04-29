/**
 * Per-element design overrides written by the /admin/design editor.
 * Style is shared across locales; per-locale TEXT overrides live in
 * the existing site_content table.
 *
 * Floating elements (created via the editor's "+ Text" button) live
 * in the same table. They are identified by `_kind: 'floating'` and
 * carry their own page binding, text, and absolute coordinates.
 */
export type DesignOverrides = {
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

  // --- Visibility ---
  hidden?: boolean;

  // --- Floating-element fields (only present on `_kind: 'floating'`) ---
  _kind?: "floating";
  _page?: string;
  /** English text. Per-locale text deferred to Phase 3b. */
  _text?: string;
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
