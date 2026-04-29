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
 * Reactive flag for whether the runtime is currently in dark mode —
 * either via the real `.dark` class on <html> (next-themes) or via
 * the editor's `.fl-night-preview` marker class. Updates live as
 * those classes flip so style overrides switch without a refresh.
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
