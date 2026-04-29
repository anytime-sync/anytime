"use client";

import {
  type CSSProperties,
  type ElementType,
  type ReactNode,
  forwardRef,
} from "react";
import { useDesign, useIsDark } from "./provider";
import { overridesToStyle } from "./style";

/**
 * Lightweight wrapper that registers an editable slot. Pass a stable
 * `id` (e.g. "landing.hero.title") and any default Tailwind classes
 * via `className`. The slot:
 *   1. attaches `data-design-id` so the /admin/design editor can find
 *      it inside its iframe and outline / select it on click,
 *   2. reads any persisted overrides from <DesignProvider> and merges
 *      them into the inline `style` (overriding Tailwind defaults),
 *   3. optionally accepts `textKey` - the i18n key whose translation
 *      this slot renders. Double-clicking a slot with `textKey` in
 *      the editor enables inline contentEditable; the new text is
 *      written to site_content for the current locale.
 *
 * Use the polymorphic `as` prop to render any tag, e.g.
 *   <DesignSlot id="..." as="h1" className="font-display text-7xl">
 */

type DesignSlotProps<E extends ElementType = "div"> = {
  id: string;
  as?: E;
  /** i18n key this slot renders. Enables inline text editing. */
  textKey?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
} & Omit<React.ComponentPropsWithoutRef<E>, "as" | "id" | "style" | "children" | "className">;

function DesignSlotInner(
  { id, as, textKey, children, className, style, ...rest }: DesignSlotProps,
  ref: React.Ref<HTMLElement>
) {
  const Tag = (as ?? "div") as ElementType;
  const overrides = useDesign(id);
  const isDark = useIsDark();
  if (overrides.hidden) return null;
  const merged: CSSProperties = { ...style, ...overridesToStyle(overrides, isDark) };
  const dataAttrs: Record<string, string> = { "data-design-id": id };
  if (textKey) dataAttrs["data-design-text-key"] = textKey;
  return (
    <Tag
      ref={ref}
      {...dataAttrs}
      className={className}
      style={merged}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </Tag>
  );
}

export const DesignSlot = forwardRef(DesignSlotInner) as <
  E extends ElementType = "div"
>(
  props: DesignSlotProps<E> & { ref?: React.Ref<HTMLElement> }
) => React.ReactElement | null;
