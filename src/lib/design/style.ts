import type { CSSProperties } from "react";
import type { DesignOverrides, StyleFields } from "./types";

/**
 * Translate a DesignOverrides blob into a React inline-style object.
 * Inline style is what we apply at runtime — it beats Tailwind class
 * defaults via CSS specificity, which is the whole point.
 *
 * Per-mode + per-language resolution. Last one wins per field:
 *   1. top-level (baseline / English / day)
 *   2. top-level `night` (when isDark)
 *   3. langs[lang] (when lang is non-English and override exists)
 *   4. langs[lang].night (when isDark, same condition)
 *
 * Existing rows without `langs` render identically to before, and
 * rows without `night` still pick top-level fields cleanly.
 *
 * Floating elements (`_kind: 'floating'`) get position:absolute and
 * left/top from `_x` / `_y` on top of all the typography overrides.
 */
export function overridesToStyle(
  o: DesignOverrides | undefined,
  isDark = false,
  lang: string = "en"
): CSSProperties {
  const s: CSSProperties = {};
  if (!o) return s;
  const ov: DesignOverrides = o;
  // Skip the langs lookup for English — that's the baseline and
  // editor writes never populate `langs.en`.
  const langOv =
    lang && lang !== "en" && ov.langs ? ov.langs[lang] : undefined;

  function pick<K extends keyof StyleFields>(key: K): StyleFields[K] | undefined {
    if (
      isDark &&
      langOv?.night &&
      (langOv.night as StyleFields)[key] !== undefined
    ) {
      return (langOv.night as StyleFields)[key];
    }
    if (langOv && (langOv as StyleFields)[key] !== undefined) {
      return (langOv as StyleFields)[key];
    }
    if (isDark && ov.night && ov.night[key] !== undefined) {
      return ov.night[key];
    }
    return ov[key];
  }

  const fontFamily = pick("fontFamily");
  if (fontFamily) s.fontFamily = fontFamily;
  const fontSize = pick("fontSize");
  if (fontSize) s.fontSize = fontSize;
  const fontWeight = pick("fontWeight");
  if (fontWeight) s.fontWeight = fontWeight;
  const fontStyle = pick("fontStyle");
  if (fontStyle) s.fontStyle = fontStyle;
  const letterSpacing = pick("letterSpacing");
  if (letterSpacing) s.letterSpacing = letterSpacing;
  const lineHeight = pick("lineHeight");
  if (lineHeight) s.lineHeight = lineHeight;
  const color = pick("color");
  if (color) s.color = color;
  const textAlign = pick("textAlign");
  if (textAlign) s.textAlign = textAlign;
  const opacity = pick("opacity");
  if (typeof opacity === "number") s.opacity = opacity;

  const tX = pick("translateX");
  const tY = pick("translateY");
  const sc = pick("scale");
  const rot = pick("rotate");
  const transforms: string[] = [];
  if (typeof tX === "number" || typeof tY === "number") {
    transforms.push(`translate(${tX ?? 0}px, ${tY ?? 0}px)`);
  }
  if (typeof sc === "number") transforms.push(`scale(${sc})`);
  if (typeof rot === "number") transforms.push(`rotate(${rot}deg)`);
  if (transforms.length > 0) s.transform = transforms.join(" ");

  const bgImageUrl = pick("bgImageUrl");
  if (bgImageUrl) {
    s.backgroundImage = `url(${bgImageUrl})`;
    s.backgroundPosition = pick("bgPosition") ?? "center";
    s.backgroundSize = pick("bgSize") ?? "cover";
    s.backgroundRepeat = "no-repeat";
  }

  const width = pick("width");
  if (width) s.width = width;
  const height = pick("height");
  if (height) s.height = height;

  // Floating elements: free-positioned overlay.
  if (o._kind === "floating") {
    s.position = "absolute";
    if (typeof o._x === "number") s.left = o._x + "px";
    if (typeof o._y === "number") s.top = o._y + "px";
    if (s.zIndex === undefined) s.zIndex = 30;
  }
  return s;
}
