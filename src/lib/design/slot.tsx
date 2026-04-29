"use client";

import {
  type CSSProperties,
  type ElementType,
  type ReactNode,
  forwardRef,
} from "react";
import { useDesign } from "./provider";
import { overridesToStyle } from "./style";

/**
 * Lightweight wrapper that registers an editable slot. Pass a stable
 * `id` (e.g. "landing.hero.title") and any default Tailwind classes
 * via `className`. The slot:
 *   1. attaches `data-design-id` so the /admin/design editor can find
 *      it inside its iframe and outline / select it on click,
 *   2. reads any persisted overrides from <DesignProvider> and merges
 *      them into the inline `style` (overriding Tailwind defaults).
 *
 * Use the polymorphic `as` prop to render any tag, e.g.
 *   <DesignSlot id="..." as="h1" className="font-display text-7xl">
 *
 * Everything is opt-in — slots are only added to elements you want
 * the admin to be able to tune.
 */

type DesignSlotProps<E extends ElementType = "div"> = {
  id: string;
  as?: E;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
} & Omit<React.ComponentPropsWithoutRef<E>, "as" | "id" | "style" | "children" | "className">;

function DesignSlotInner(
  { id, as, children, className, style, ...rest }: DesignSlotProps,
  ref: React.Ref<HTMLElement>
) {
  const Tag = (as ?? "div") as ElementType;
  const overrides = useDesign(id);
  if (overrides.hidden) return null;
  const merged: CSSProperties = { ...style, ...overridesToStyle(overrides) };
  return (
    <Tag
      ref={ref}
      data-design-id={id}
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
