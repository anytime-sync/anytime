"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { CommandPalette } from "./command-palette";
import { TaskDetailPanel } from "./task-detail-panel";
import { QuickAdd } from "./quick-add";
import { Reminders } from "./reminders";
import { useUIStore } from "@/store/ui";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";

export function AppShell({
  user,
  children,
}: {
  user: { id: string; email: string; name: string | null };
  children: React.ReactNode;
}) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setCmdOpen = useUIStore((s) => s.setCommandOpen);
  const [mounted, setMounted] = useState(false);

  useRealtimeSync();

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
    <div className="h-screen w-screen overflow-hidden grid"
      style={{
        gridTemplateColumns: sidebarCollapsed ? "64px 1fr" : "260px 1fr",
        transition: "grid-template-columns 200ms ease",
      }}
    >
      <Sidebar user={user} />
      <main className="relative h-screen overflow-hidden flex">
        <div className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
          {mounted ? children : null}
        </div>
        <TaskDetailPanel />
      </main>
      <CommandPalette />
      <QuickAdd />
      <Reminders />
    </div>
  );
}
