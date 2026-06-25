"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { CommandPalette } from "./command-palette";
import { TaskDetailPanel } from "./task-detail-panel";
import { QuickAdd } from "./quick-add";
import { Reminders } from "./reminders";
import { useUIStore } from "@/store/ui";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useTimezoneSync } from "@/hooks/use-timezone-sync";
import { ImpersonationBanner } from "./impersonation-banner";
import { AnnouncementBanner } from "./announcement-banner";
import { GoalModal } from "./goal-modal";
import { ReflectionDialog } from "./reflection-dialog";

export function AppShell({
  user,
  children,
}: {
  user: { id: string; email: string; name: string | null };
  children: React.ReactNode;
}) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setCmdOpen = useUIStore((s) => s.setCommandOpen);
  // `mounted` guards only the persisted sidebar width (zustand/persist reads
  // from localStorage which is unavailable during SSR). Children must always
  // render — gating them caused a flash on every client-side navigation because
  // AppShell re-renders and mounted briefly resets to false.
  const [mounted, setMounted] = useState(false);

  useRealtimeSync();
  useTimezoneSync();

  useEffect(() => {
    setMounted(true);
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setCmdOpen]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col">
      <ImpersonationBanner />
      <AnnouncementBanner />
      <div className="flex-1 min-h-0 grid"
        style={{
          // Use a safe default (collapsed=false → 260px) until localStorage
          // has been read. This avoids a hydration mismatch on the column
          // width without hiding children.
          gridTemplateColumns: (mounted ? sidebarCollapsed : false) ? "64px 1fr" : "260px 1fr",
          transition: "grid-template-columns 200ms ease",
        }}
      >
        <Sidebar user={user} />
        <main className="relative h-full overflow-hidden flex">
          <div className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
            {children}
          </div>
          <TaskDetailPanel />
        </main>
      </div>
      <CommandPalette />
      <QuickAdd />
      <GoalModal />
      <ReflectionDialog />
      <Reminders />
    </div>
  );
}
