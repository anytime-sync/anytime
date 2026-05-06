"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type UIState = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;

  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;

  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;

  quickAddOpen: boolean;
  setQuickAddOpen: (v: boolean) => void;

  goalModalOpen: boolean;
  setGoalModalOpen: (v: boolean) => void;

  reflectionOpen: boolean;
  setReflectionOpen: (v: boolean) => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      selectedTaskId: null,
      setSelectedTaskId: (id) => set({ selectedTaskId: id }),
      commandOpen: false,
      setCommandOpen: (v) => set({ commandOpen: v }),
      quickAddOpen: false,
      setQuickAddOpen: (v) => set({ quickAddOpen: v }),
      goalModalOpen: false,
      setGoalModalOpen: (v) => set({ goalModalOpen: v }),
      reflectionOpen: false,
      setReflectionOpen: (v) => set({ reflectionOpen: v }),
    }),
    { name: "tt-ui", partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) }
  )
);
