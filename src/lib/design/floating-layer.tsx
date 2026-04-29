"use client";

import { useEffect, useState } from "react";
import { useDesignMap } from "./provider";
import { DesignSlot } from "./slot";
import { readStoredLanguage } from "@/lib/i18n";

/**
 * Renders all floating-text overlays for a given page path.
 * Floating elements are stored in `site_design` with overrides
 * containing `_kind: 'floating'` + `_page`. They're rendered on top
 * of regular page content as absolutely-positioned slots.
 *
 * Text rendering picks the current locale from `_texts[lang]` and
 * falls back to `_text` (the English baseline) when no override
 * exists. The locale is read from the same localStorage key
 * (`fl.language`) used elsewhere so it follows the language picker.
 */
export function FloatingLayer({ page }: { page: string }) {
  const map = useDesignMap();
  const [lang, setLang] = useState<string>("en");
  useEffect(() => {
    setLang(readStoredLanguage());
    function onStorage(e: StorageEvent) {
      if (e.key === "fl.language") setLang(readStoredLanguage());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const items = Object.entries(map).filter(
    ([, ov]) => ov?._kind === "floating" && ov?._page === page
  );
  if (items.length === 0) return null;
  return (
    <>
      {items.map(([id, ov]) => {
        const text = ov._texts?.[lang] ?? ov._text ?? "";
        return (
          <DesignSlot key={id} id={id} as="div">
            {text}
          </DesignSlot>
        );
      })}
    </>
  );
}
