"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DesignMap, DesignOverrides } from "./types";
import { generateClassOverridesCss } from "./class-css";

/**
 * Client-side design context. The root layout fetches the full
 * site_design map on the server and seeds this provider; the editor
 * iframe also listens for postMessage updates from the parent so live
 * preview works without a round-trip to the database.
 */
const DesignContext = createContext<DesignMap>({});

export function DesignProvider({
  initial,
  children,
}: {
  initial: DesignMap;
  children: ReactNode;
}) {
  const [map, setMap] = useState<DesignMap>(initial);

  // When mounted inside the /admin/design editor's iframe we listen
  // for live override updates from the parent and apply them
  // optimistically. Outside the editor this listener is harmless —
  // the parent never posts.
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const data = ev.data as
        | { type: "fl.design.update"; elementId: string; overrides: DesignOverrides | null }
        | { type: "fl.design.bulk"; map: DesignMap }
        | undefined;
      if (!data || typeof data !== "object" || !("type" in data)) return;
      if (data.type === "fl.design.update") {
        setMap((prev) => {
          const next = { ...prev };
          if (data.overrides == null) {
            delete next[data.elementId];
          } else {
            next[data.elementId] = data.overrides;
          }
          return next;
        });
      } else if (data.type === "fl.design.bulk") {
        setMap(data.map);
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Keep the server-rendered <style id="fl-class-overrides"> tag in sync
  // with live edits. The root layout emits initial CSS from server-side
  // generation; whenever the operator tweaks a class override in the
  // /admin/design editor, the iframe receives a postMessage update and
  // we regenerate + replace the tag's textContent so the preview reflects
  // the change without a reload. Outside the editor this is harmless —
  // the map only changes on initial mount.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const css = generateClassOverridesCss(map);
    let tag = document.getElementById(
      "fl-class-overrides"
    ) as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement("style");
      tag.id = "fl-class-overrides";
      document.head.appendChild(tag);
    }
    if (tag.textContent !== css) tag.textContent = css;
  }, [map]);

  const value = useMemo(() => map, [map]);
  return (
    <DesignContext.Provider value={value}>{children}</DesignContext.Provider>
  );
}

export function useDesign(elementId: string): DesignOverrides {
  const map = useContext(DesignContext);
  return map[elementId] ?? {};
}

export function useDesignMap(): DesignMap {
  return useContext(DesignContext);
}

/**
 * Returns whether the document is currently rendering in dark mode.
 *
 * Two signals trigger dark-mode resolution:
 *   1. `<html class="dark">` — set by next-themes when the user
 *      actually flips to the dark palette.
 *   2. `<html class="fl-night-preview">` — set by the /admin/design
 *      editor when the operator clicks "Editing Night" so they can
 *      preview night styles regardless of their own theme choice.
 *
 * Updates reactively via a MutationObserver on `<html>`'s class list.
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    function update() {
      const cl = document.documentElement.classList;
      setIsDark(cl.contains("dark") || cl.contains("fl-night-preview"));
    }
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);
  return isDark;
}
