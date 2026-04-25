"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  CalendarDays,
  CalendarRange,
  Sun,
  Sunrise,
  Hash,
  Folder,
  Clock,
  Sparkles,
  LayoutGrid,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  SunMedium,
} from "lucide-react";
import { useUIStore } from "@/store/ui";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/use-projects";
import { useTags } from "@/hooks/use-tags";
import { CreateProjectDialog } from "./create-project-dialog";
import { useState } from "react";

const TOP_LINKS = [
  { href: "/app/today", label: "Today", icon: Sun },
  { href: "/app/tomorrow", label: "Tomorrow", icon: Sunrise },
  { href: "/app/next7", label: "Next 7 Days", icon: CalendarRange },
  { href: "/app/inbox", label: "Inbox", icon: Inbox },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/app/matrix", label: "Eisenhower", icon: LayoutGrid },
  { href: "/app/pomodoro", label: "Pomodoro", icon: Clock },
  { href: "/app/habits", label: "Habits", icon: Sparkles },
];

export function Sidebar({ user }: { user: { email: string; name: string | null } }) {
  const pathname = usePathname();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const setCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const setCmdOpen = useUIStore((s) => s.setCommandOpen);
  const setQuickAdd = useUIStore((s) => s.setQuickAddOpen);
  const { data: projects = [] } = useProjects();
  const { data: tags = [] } = useTags();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <aside className="h-screen border-r border-border bg-panel flex flex-col">
      {/* header */}
      <div className="flex items-center justify-between px-3 h-14 border-b border-border">
        {!collapsed && (
          <div className="font-semibold tracking-tight">Anytime</div>
        )}
        <button
          className="btn-ghost h-8 px-2"
          aria-label="Toggle sidebar"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>

      {/* quick actions */}
      <div className="p-2 space-y-1">
        <button
          className={cn("w-full btn-primary justify-start gap-2", collapsed && "px-0 justify-center")}
          onClick={() => setQuickAdd(true)}
        >
          <Plus className="size-4" />
          {!collapsed && <span>Add task</span>}
        </button>
        <button
          className={cn("w-full btn-ghost justify-start gap-2", collapsed && "px-0 justify-center")}
          onClick={() => setCmdOpen(true)}
        >
          <Search className="size-4" />
          {!collapsed && <span>Search…</span>}
          {!collapsed && (
            <span className="ml-auto text-xs text-muted-fg">⌘K</span>
          )}
        </button>
      </div>

      {/* nav */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-4">
        <div>
          {TOP_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 h-9 px-2 rounded-md text-sm",
                  active ? "bg-muted text-fg" : "text-muted-fg hover:bg-muted hover:text-fg",
                  collapsed && "justify-center"
                )}
                title={label}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </div>

        {!collapsed && (
          <>
            <div>
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-xs uppercase tracking-wider text-muted-fg">Lists</span>
                <button
                  className="text-muted-fg hover:text-fg"
                  onClick={() => setShowCreate(true)}
                  aria-label="New list"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              <div className="space-y-0.5">
                {projects.map((p) => {
                  const href = `/app/lists/${p.id}`;
                  const active = pathname === href;
                  return (
                    <Link
                      key={p.id}
                      href={href}
                      className={cn(
                        "flex items-center gap-2 h-9 px-2 rounded-md text-sm",
                        active ? "bg-muted text-fg" : "text-muted-fg hover:bg-muted hover:text-fg"
                      )}
                    >
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <Folder className="size-4 shrink-0 text-muted-fg" />
                      <span className="truncate">{p.name}</span>
                    </Link>
                  );
                })}
                {projects.length === 0 && (
                  <p className="text-xs text-muted-fg px-2">No lists yet.</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-xs uppercase tracking-wider text-muted-fg">Tags</span>
              </div>
              <div className="space-y-0.5">
                {tags.map((t) => {
                  const href = `/app/tags/${encodeURIComponent(t.name)}`;
                  const active = pathname === href;
                  return (
                    <Link
                      key={t.id}
                      href={href}
                      className={cn(
                        "flex items-center gap-2 h-9 px-2 rounded-md text-sm",
                        active ? "bg-muted text-fg" : "text-muted-fg hover:bg-muted hover:text-fg"
                      )}
                    >
                      <Hash className="size-4 shrink-0" style={{ color: t.color }} />
                      <span className="truncate">{t.name}</span>
                    </Link>
                  );
                })}
                {tags.length === 0 && (
                  <p className="text-xs text-muted-fg px-2">
                    No tags yet — type <code className="text-fg">#tagname</code> in a task title.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </nav>

      {/* footer */}
      <div className="border-t border-border p-2 flex items-center gap-2">
        <button
          className={cn(
            "btn-ghost size-9 p-0 grid place-items-center",
            collapsed && "mx-auto"
          )}
          onClick={() =>
            setTheme((resolvedTheme ?? theme) === "dark" ? "light" : "dark")
          }
          title="Toggle theme"
        >
          {(resolvedTheme ?? theme) === "dark" ? (
            <SunMedium className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
        </button>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-xs">
              <div className="font-medium truncate">{user.name ?? user.email}</div>
              <div className="text-muted-fg truncate">{user.email}</div>
            </div>
            <form action="/auth/signout" method="post">
              <button className="btn-ghost size-9 p-0 grid place-items-center" title="Log out">
                <LogOut className="size-4" />
              </button>
            </form>
          </>
        )}
      </div>

      {showCreate && <CreateProjectDialog onClose={() => setShowCreate(false)} />}
    </aside>
  );
}
