import type { CSSProperties } from "react";
import type { DesignOverrides, StyleFields } from "./types";

/**
 * Translate a DesignOverrides blob into a React inline-style object.
 * Inline style is what we apply at runtime — it beats Tailwind class
 * defaults via CSS specificity, which is the whole point.
 *
 * Per-mode resolution: when `isDark` is true, every field defined
 * inside `o.night` wins over its day counterpart. Any field NOT
 * defined inside `night` still falls back to the top-level (day)
 * value, so existing rows render identically to before.
 *
 * Floating elements (`_kind: 'floating'`) get position:absolute and
 * left/top from `_x` / `_y` on top of all the typography overrides.
 */
export function overridesToStyle(
  o: DesignOverrides | undefined,
  isDark = false
): CSSProperties {
  const s: CSSProperties = {};
  if (!o) return s;
  const ov: DesignOverrides = o;

  function pick<K extends keyof StyleFields>(key: K): StyleFields[K] | undefined {
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
