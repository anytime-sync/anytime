import type { CSSProperties } from "react";
import type { DesignOverrides, StyleFields } from "./types";

/**
 * Translate a DesignOverrides blob into a React inline-style object.
 * Inline style is what we apply at runtime - it beats Tailwind class
 * defaults via CSS specificity, which is the whole point.
 *
 * `isDark` switches the resolution to the night-mode override block:
 * each style field falls through `night.X ?? X` so day values keep
 * acting as a fallback when night isn't customised.
 *
 * Background images keep the existing dual-CSS-variable approach
 * (`--fl-bg-light` / `--fl-bg-dark`) so they swap purely via CSS
 * rules in globals.css — no React re-render needed when the theme
 * toggles. Other style fields aren't well suited to that, so they
 * resolve here based on the `isDark` flag the caller passes in.
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

  // For non-bg-image style fields, prefer night overrides when dark.
  const night: Partial<StyleFields> | undefined = isDark ? ov.night : undefined;
  function pick<K extends keyof StyleFields>(key: K): StyleFields[K] | undefined {
    if (night && night[key] !== undefined) return night[key];
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

  const transforms: string[] = [];
  const translateX = pick("translateX");
  const translateY = pick("translateY");
  if (typeof translateX === "number" || typeof translateY === "number") {
    transforms.push(`translate(${translateX ?? 0}px, ${translateY ?? 0}px)`);
  }
  const scale = pick("scale");
  if (typeof scale === "number") transforms.push(`scale(${scale})`);
  const rotate = pick("rotate");
  if (typeof rotate === "number") transforms.push(`rotate(${rotate}deg)`);
  if (transforms.length > 0) s.transform = transforms.join(" ");

  // Background image — emitted as CSS variables (--fl-bg-light / --fl-bg-dark)
  // so light/dark modes can switch via globals.css rules without React having
  // to know which theme is active. Both tracks read from the override directly
  // (the legacy bgImageUrlDark fields are still honoured).
  const lightUrl = o.bgImageUrl;
  const darkUrl = o.night?.bgImageUrl ?? o.bgImageUrlDark;
  const lightPos = o.bgPosition;
  const darkPos = o.night?.bgPosition ?? o.bgPositionDark;
  const lightSize = o.bgSize;
  const darkSize = o.night?.bgSize ?? o.bgSizeDark;
  if (lightUrl) {
    const sv = s as Record<string, string>;
    sv["--fl-bg-light"] = `url(${lightUrl})`;
    sv["--fl-bg-pos-light"] = lightPos ?? "center";
    sv["--fl-bg-size-light"] = lightSize ?? "cover";
    s.backgroundRepeat = "no-repeat";
  }
  if (darkUrl) {
    const sv = s as Record<string, string>;
    sv["--fl-bg-dark"] = `url(${darkUrl})`;
    sv["--fl-bg-pos-dark"] = darkPos ?? "center";
    sv["--fl-bg-size-dark"] = darkSize ?? "cover";
    s.backgroundRepeat = "no-repeat";
  }

  // Element dimensions
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
