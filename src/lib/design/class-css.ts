import type { DesignMap, StyleFields } from "./types";

/**
 * Server-side generator: turns the design map's `class:CLASSNAME`
 * entries into a single CSS string that can be injected as a
 * <style> block in the document <head>.
 *
 * For each class entry we may emit up to (1 + 1 + N + N) rules where
 * N is the number of languages with overrides:
 *   - baseline / day / English          → `.CLASS { ... }`
 *   - baseline night                     → `html.dark .CLASS, html.fl-night-preview .CLASS { ... }`
 *   - per-language day                   → `html[lang="xx"] .CLASS { ... }`
 *   - per-language night                 → `html[lang="xx"].dark .CLASS, html[lang="xx"].fl-night-preview .CLASS { ... }`
 *
 * `!important` is appended to every declaration so these rules win
 * over Tailwind utility defaults that may have higher specificity by
 * appearing later in the cascade. (The editor's per-element overrides
 * use inline style which already beats class rules; for class targets
 * we don't have that luxury, hence !important.)
 */
export function generateClassOverridesCss(map: DesignMap): string {
  const blocks: string[] = [];
  for (const [elementId, overrides] of Object.entries(map)) {
    if (overrides._kind !== "class") continue;
    const cls = overrides._class || elementId.replace(/^class:/, "");
    if (!cls || !/^[\w-]+$/.test(cls)) continue;
    const safeClass = cssEscapeClass(cls);

    // 1. baseline / day / English
    const dayDecl = stringifyDecls(overrides);
    if (dayDecl) blocks.push(`.${safeClass}{${dayDecl}}`);

    // 2. baseline night
    if (overrides.night) {
      const nightDecl = stringifyDecls(overrides.night);
      if (nightDecl) {
        blocks.push(
          `html.dark .${safeClass},html.fl-night-preview .${safeClass}{${nightDecl}}`
        );
      }
    }

    // 3 + 4. per-language buckets
    if (overrides.langs) {
      for (const [lang, langOv] of Object.entries(overrides.langs)) {
        if (lang === "en") continue; // English is the implicit baseline
        const safeLang = cssEscapeAttr(lang);
        const langDay = stringifyDecls(langOv);
        if (langDay) {
          blocks.push(`html[lang="${safeLang}"] .${safeClass}{${langDay}}`);
        }
        if (langOv.night) {
          const langNight = stringifyDecls(langOv.night);
          if (langNight) {
            blocks.push(
              `html[lang="${safeLang}"].dark .${safeClass},html[lang="${safeLang}"].fl-night-preview .${safeClass}{${langNight}}`
            );
          }
        }
      }
    }
  }
  return blocks.join("");
}

/**
 * Turn a StyleFields blob into a list of CSS declarations like
 * `font-size:14px !important;color:#abc !important;`. Skips fields
 * that don't make sense as class-level overrides (background image
 * URL — that one really does want to be per-element).
 */
function stringifyDecls(s: StyleFields | undefined): string {
  if (!s) return "";
  const decls: string[] = [];
  function push(prop: string, value: string | number | undefined | null) {
    if (value === undefined || value === null || value === "") return;
    decls.push(`${prop}:${value} !important`);
  }
  push("font-family", s.fontFamily);
  push("font-size", s.fontSize);
  push("font-weight", s.fontWeight);
  push("font-style", s.fontStyle);
  push("letter-spacing", s.letterSpacing);
  push("line-height", s.lineHeight);
  push("color", escapeCssValue(s.color));
  push("text-align", s.textAlign);
  if (typeof s.opacity === "number") push("opacity", s.opacity);
  if (typeof s.width === "string") push("width", s.width);
  if (typeof s.height === "string") push("height", s.height);

  // Transform: combine translate / scale / rotate
  const transforms: string[] = [];
  if (typeof s.translateX === "number" || typeof s.translateY === "number") {
    transforms.push(`translate(${s.translateX ?? 0}px,${s.translateY ?? 0}px)`);
  }
  if (typeof s.scale === "number") transforms.push(`scale(${s.scale})`);
  if (typeof s.rotate === "number") transforms.push(`rotate(${s.rotate}deg)`);
  if (transforms.length > 0) push("transform", transforms.join(" "));

  // Background — only position / size at the class level. Background
  // image URLs as class overrides risk hot-loading huge images for
  // every matching element, so keep those per-element.
  if (s.bgImageUrl) {
    push("background-image", `url(${escapeCssValue(s.bgImageUrl)})`);
  }
  if (s.bgPosition) push("background-position", s.bgPosition);
  if (s.bgSize) push("background-size", s.bgSize);

  return decls.join(";") + (decls.length ? ";" : "");
}

/**
 * CSS class names in the editor are restricted to [\w-]+, but defense
 * in depth: identity-pass is fine for that charset.
 */
function cssEscapeClass(cls: string): string {
  return cls;
}

/**
 * Language codes are alphanumeric + dash (en, zh-TW, ja, ...). Same
 * defense-in-depth identity pass.
 */
function cssEscapeAttr(s: string): string {
  return s.replace(/["\\]/g, "");
}

/**
 * Strip CSS-injection vectors out of free-text values (color hex,
 * URL strings). We can't allow `}` or `;` inside a declaration value
 * to escape the rule.
 */
function escapeCssValue(v: string | undefined | null): string | undefined {
  if (v === undefined || v === null) return undefined;
  return v.replace(/[};<>\r\n]/g, "");
}
