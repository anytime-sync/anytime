"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox, CalendarDays, CalendarRange, Sun, Sunrise, Hash, Folder, Clock,
  Sparkles, LayoutGrid, Search, Plus, ChevronLeft, ChevronRight, LogOut,
  Moon, SunMedium, Newspaper,
} from "lucide-react";
import { useUIStore } from "@/store/ui";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/use-projects";
import { useTags } from "@/hooks/use-tags";
import { CreateProjectDialog } from "./create-project-dialog";
import { LanguagePicker } from "./language-picker";
import { SidebarListItem } from "./sidebar-list-item";
import { useState } from "react";
import { useLanguage, t } from "@/lib/i18n";

type Lang = ReturnType<typeof useLanguage>;
function topLinks(lang: Lang) {
  return [
    { href: "/app/today",    label: t(lang, "sidebar.today"),         icon: Sun },
    { href: "/app/tomorrow", label: t(lang, "sidebar.tomorrow"),      icon: Sunrise },
    { href: "/app/next7",    label: t(lang, "sidebar.next7"),         icon: CalendarRange },
    { href: "/app/inbox",    label: t(lang, "sidebar.inbox"),         icon: Inbox },
    { href: "/app/calendar", label: t(lang, "sidebar.calendar"),      icon: CalendarDays },
    { href: "/app/matrix",   label: t(lang, "sidebar.eisenhower"),    icon: LayoutGrid },
    { href: "/app/pomodoro", label: t(lang, "sidebar.pomodoro"),      icon: Clock },
    { href: "/app/habits",   label: t(lang, "sidebar.habits"),        icon: Sparkles },
    { href: "/app/retro",    label: t(lang, "sidebar.weeklyReview"), icon: Newspaper },
  ];
}

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
  const lang = useLanguage();
  const TOP_LINKS = topLinks(lang);

  return (
    <aside className="h-screen border-r border-border surface flex flex-col">
      {/* Wordmark — centered horizontally; toggle absolute-positioned
          on the right so it doesn't push the wordmark off-center. */}
      <div className="relative flex items-center justify-center px-3 h-14 border-b border-border">
        {!collapsed && (
          <div className="wordmark text-[15px]">First Light</div>
        )}
        <button
          className="btn-ghost h-8 px-2 absolute right-2 top-1/2 -translate-y-1/2"
          aria-label="Toggle sidebar"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>

      <div className="p-2 space-y-1">
        <button
          className={cn("w-full btn-primary justify-start gap-2", collapsed && "px-0 justify-center")}
          onClick={() => setQuickAdd(true)}
        >
          <Plus className="size-4" />
          {!collapsed && <span>{t(lang, "sidebar.addTask")}</span>}
        </button>
        <button
          className={cn("w-full btn-ghost justify-start gap-2", collapsed && "px-0 justify-center")}
          onClick={() => setCmdOpen(true)}
        >
          <Search className="size-4" />
          {!collapsed && <span>{t(lang, "sidebar.search")}</span>}
          {!collapsed && <span className="ml-auto text-xs text-muted-fg">⌘K</span>}
        </button>
      </div>

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
                <span className="editorial-number text-[10px] uppercase tracking-[0.18em]">{t(lang, "sidebar.lists")}</span>
                <button
                  className="text-muted-fg hover:text-fg"
                  onClick={() => setShowCreate(true)}
                  aria-label={t(lang, "sidebar.newList")}
                >
                  <Plus className="size-4" />
                </button>
              </div>
              <div className="space-y-0.5">
                {projects.map((p) => (
                  <SidebarListItem
                    key={p.id}
                    project={p}
                    active={pathname === `/app/lists/${p.id}`}
                  />
                ))}
                {projects.length === 0 && (
                  <p className="text-xs text-muted-fg px-2">{t(lang, "sidebar.noLists")}</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="editorial-number text-[10px] uppercase tracking-[0.18em]">{t(lang, "sidebar.tags")}</span>
              </div>
              <div className="space-y-0.5">
                {tags.map((tag) => {
                  const href = `/app/tags/${encodeURIComponent(tag.name)}`;
                  const active = pathname === href;
                  return (
                    <Link
                      key={tag.id}
                      href={href}
                      className={cn(
                        "flex items-center gap-2 h-9 px-2 rounded-md text-sm",
                        active ? "bg-muted text-fg" : "text-muted-fg hover:bg-muted hover:text-fg"
                      )}
                    >
                      <Hash className="size-4 shrink-0" style={{ color: tag.color }} />
                      <span className="truncate">{tag.name}</span>
                    </Link>
                  );
                })}
                {tags.length === 0 && (
                  <p className="text-xs text-muted-fg px-2">{t(lang, "sidebar.noTags")}</p>
                )}
              </div>
            </div>
          </>
        )}
      </nav>

      <div className="border-t border-border p-2 flex items-center gap-2">
        <button
          className={cn("btn-ghost size-9 p-0 grid place-items-center", collapsed && "mx-auto")}
          onClick={() =>
            setTheme((resolvedTheme ?? theme) === "dark" ? "light" : "dark")
          }
          title="Toggle theme"
        >
          {(resolvedTheme ?? theme) === "dark" ? <SunMedium className="size-4" /> : <Moon className="size-4" />}
        </button>
        {!collapsed && <LanguagePicker />}
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0 text-xs">
              <div className="font-medium truncate">{user.name ?? user.email}</div>
              <div className="text-muted-fg truncate">{user.email}</div>
            </div>
            <form action="/auth/signout" method="post">
              <button className="btn-ghost size-9 p-0 grid place-items-center" title={t(lang, "sidebar.logout")}>
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
