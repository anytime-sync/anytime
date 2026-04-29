import type { CSSProperties } from "react";
import type { DesignOverrides } from "./types";

/**
 * Translate a DesignOverrides blob into a React inline-style object.
 * Inline style is what we apply at runtime - it beats Tailwind class
 * defaults via CSS specificity, which is the whole point.
 *
 * Floating elements (`_kind: 'floating'`) get position:absolute and
 * left/top from `_x` / `_y` on top of all the typography overrides.
 */
export function overridesToStyle(o: DesignOverrides | undefined): CSSProperties {
  const s: CSSProperties = {};
  if (!o) return s;
  if (o.fontFamily) s.fontFamily = o.fontFamily;
  if (o.fontSize) s.fontSize = o.fontSize;
  if (o.fontWeight) s.fontWeight = o.fontWeight;
  if (o.fontStyle) s.fontStyle = o.fontStyle;
  if (o.letterSpacing) s.letterSpacing = o.letterSpacing;
  if (o.lineHeight) s.lineHeight = o.lineHeight;
  if (o.color) s.color = o.color;
  if (o.textAlign) s.textAlign = o.textAlign;
  if (typeof o.opacity === "number") s.opacity = o.opacity;

  const transforms: string[] = [];
  if (typeof o.translateX === "number" || typeof o.translateY === "number") {
    transforms.push(
      `translate(${o.translateX ?? 0}px, ${o.translateY ?? 0}px)`
    );
  }
  if (typeof o.scale === "number") transforms.push(`scale(${o.scale})`);
  if (typeof o.rotate === "number") transforms.push(`rotate(${o.rotate}deg)`);
  if (transforms.length > 0) s.transform = transforms.join(" ");

  // Background image — emitted as CSS variables (--fl-bg-light / --fl-bg-dark)
  // so light/dark modes can switch via globals.css rules without React having
  // to know which theme is active. The `.dark [data-design-id]` and
  // `.fl-night-preview [data-design-id]` selectors there read these vars.
  if (o.bgImageUrl) {
    const sv = s as Record<string, string>;
    sv["--fl-bg-light"] = `url(${o.bgImageUrl})`;
    sv["--fl-bg-pos-light"] = o.bgPosition ?? "center";
    sv["--fl-bg-size-light"] = o.bgSize ?? "cover";
    s.backgroundRepeat = "no-repeat";
  }
  if (o.bgImageUrlDark) {
    const sv = s as Record<string, string>;
    sv["--fl-bg-dark"] = `url(${o.bgImageUrlDark})`;
    sv["--fl-bg-pos-dark"] = o.bgPositionDark ?? "center";
    sv["--fl-bg-size-dark"] = o.bgSizeDark ?? "cover";
    s.backgroundRepeat = "no-repeat";
  }

  // Element dimensions (mode-agnostic)
  if (o.width) s.width = o.width;
  if (o.height) s.height = o.height;

  // Floating elements: free-positioned overlay.
  if (o._kind === "floating") {
    s.position = "absolute";
    if (typeof o._x === "number") s.left = o._x + "px";
    if (typeof o._y === "number") s.top = o._y + "px";
    if (s.zIndex === undefined) s.zIndex = 30;
  }
  return s;
}
