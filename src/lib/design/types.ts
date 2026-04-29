/**
 * Per-element design overrides written by the /admin/design editor.
 * Style is shared across locales; per-locale TEXT overrides live in
 * the existing site_content table.
 *
 * Every annotated <DesignSlot id="..."/> reads its row at render time
 * and applies these as inline styles, beating the Tailwind defaults
 * because inline style wins specificity.
 */
export type DesignOverrides = {
  // --- Typography ---
  fontFamily?: string;
  fontSize?: string;        // e.g. "5rem", "72px"
  fontWeight?: string;      // "300" | "normal" | "bold" | "900"
  fontStyle?: "normal" | "italic";
  letterSpacing?: string;   // "-0.02em"
  lineHeight?: string;      // "1.05"
  color?: string;           // any CSS color
  textAlign?: "left" | "center" | "right";

  // --- Transform / position nudge ---
  translateX?: number;      // px
  translateY?: number;      // px
  scale?: number;           // 1.0 = default
  rotate?: number;          // degrees
  opacity?: number;         // 0..1

  // --- Background image ---
  bgImageUrl?: string | null;
  bgPosition?: string;      // "center", "50% 30%"
  bgSize?: string;          // "cover" | "contain" | "120%"

  // --- Visibility ---
  hidden?: boolean;
};

export type DesignMap = Record<string, DesignOverrides>;

/** A registered slot — used so the editor can show a list of every
 *  editable element on a page even before the admin has clicked one. */
export type SlotMeta = {
  id: string;
  label: string;            // "Hero · Title"
  page: string;             // "/", "/app/today", etc.
};
