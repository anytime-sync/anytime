"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox, CalendarDays, CalendarRange, CalendarSearch, Sun, Sunrise, Hash, Folder, Clock,
  Sparkles, LayoutGrid, Users, Search, Plus, ChevronLeft, ChevronRight, LogOut,
  Moon, SunMedium, Newspaper, CheckCircle2, GripVertical, Settings,
, StickyNote } from "lucide-react";
import { useUIStore } from "@/store/ui";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useProjects, useReorderProjects } from "@/hooks/use-projects";
import type { Project } from "@/lib/db.types";
import { useTags } from "@/hooks/use-tags";
import { CreateProjectDialog } from "./create-project-dialog";
import { LanguagePicker } from "./language-picker";
import { SidebarListItem } from "./sidebar-list-item";
import { NotificationBell } from "./notification-bell";
import { Target, Sunset } from "lucide-react";
import { SidebarTagItem } from "./sidebar-tag-item";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";

type Lang = ReturnType<typeof useLanguage>;

type LinkDef = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

function topLinks(lang: Lang): LinkDef[] {
  return [
    { href: "/app/today",     label: t(lang, "sidebar.today"),        icon: Sun },
    { href: "/app/tomorrow",  label: t(lang, "sidebar.tomorrow"),     icon: Sunrise },
    { href: "/app/next7",     label: t(lang, "sidebar.next7"),        icon: CalendarRange },
    { href: "/app/next90",    label: t(lang, "sidebar.next90"),       icon: CalendarSearch },
    { href: "/app/inbox",     label: t(lang, "sidebar.inbox"),        icon: Inbox },
    { href: "/app/calendar",  label: t(lang, "sidebar.calendar"),     icon: CalendarDays },
    { href: "/app/matrix",    label: t(lang, "sidebar.eisenhower"),   icon: LayoutGrid },
    { href: "/app/pomodoro",  label: t(lang, "sidebar.pomodoro"),     icon: Clock },
    { href: "/app/habits",    label: t(lang, "sidebar.habits"),       icon: Sparkles },
    { href: "/app/retro",     label: t(lang, "sidebar.weeklyReview"), icon: Newspaper },
    { href: "/app/completed", label: t(lang, "sidebar.completed"),    icon: CheckCircle2 },
    { href: "/app/groups",    label: t(lang, "sidebar.groups"),                        icon: Users },
    { href: "/app/notes",     label: t(lang, "sidebar.notes"),        icon: StickyNote },
          { href: "/app/settings",  label: t(lang, "sidebar.settings"),     icon: Settings },
  ];
}

const ORDER_KEY = "fl.sidebar.order";

/** Read saved sidebar order from localStorage; sanitize against current
 *  link set so removed/added links are handled gracefully. */
function resolveOrder(links: LinkDef[]): LinkDef[] {
  if (typeof window === "undefined") return links;
  let saved: string[] = [];
  try {
    const raw = window.localStorage.getItem(ORDER_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {}
  const byHref = new Map(links.map((l) => [l.href, l]));
  const ordered: LinkDef[] = [];
  for (const href of saved) {
    const l = byHref.get(href);
    if (l) {
      ordered.push(l);
      byHref.delete(href);
    }
  }
  // Append any links not yet in saved order (newly added in code).
  for (const l of links) if (byHref.has(l.href)) ordered.push(l);
  return ordered;
}

export function Sidebar({ user }: { user: { email: string; name: string | null } }) {
  const pathname = usePathname();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const setCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const setCmdOpen = useUIStore((s) => s.setCommandOpen);
  const setQuickAdd = useUIStore((s) => s.setQuickAddOpen);
  const setGoalModal = useUIStore((s) => s.setGoalModalOpen);
  const setReflection = useUIStore((s) => s.setReflectionOpen);
  const { data: projects = [] } = useProjects();
  const reorderProjects = useReorderProjects();
  const { data: tags = [] } = useTags();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [showCreate, setShowCreate] = useState(false);
  const lang = useLanguage();

  // Top nav: ordered links with localStorage-backed reordering.
  const baseLinks = useMemo(() => topLinks(lang), [lang]);
  const [orderedLinks, setOrderedLinks] = useState<LinkDef[]>(baseLinks);
  // Reapply the saved order whenever the language changes (link labels
  // change but href identity is stable, so order is preserved).
  useEffect(() => {
    setOrderedLinks(resolveOrder(baseLinks));
  }, [baseLinks]);

  // Click vs drag: a 5px movement is required before drag activates,
  // so a normal click still fires the <Link> navigation.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedLinks.findIndex((l) => l.href === active.id);
    const newIndex = orderedLinks.findIndex((l) => l.href === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(orderedLinks, oldIndex, newIndex);
    setOrderedLinks(next);
    try {
      window.localStorage.setItem(
        ORDER_KEY,
        JSON.stringify(next.map((l) => l.href))
      );
    } catch {}
  }

  return (
    <aside className="h-screen border-r border-border surface flex flex-col">
      <div className="relative flex items-center justify-center px-3 h-24 md:h-28 border-b border-border">
        {!collapsed && (
          <div className="wordmark text-[15px]">First Light</div>
        )}
        <button
          className="btn-ghost h-8 px-2 absolute right-2 top-1/2 -translate-y-1/2"
          aria-label={t(lang, "sidebar.toggle")}
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
        <button
          className={cn("w-full btn-ghost justify-start gap-2", collapsed && "px-0 justify-center")}
          onClick={() => setGoalModal(true)}
          title={t(lang, "sidebar.planGoal")}
        >
          <Target className="size-4" />
          {!collapsed && <span>Goal</span>}
        </button>
        <button
          className={cn("w-full btn-ghost justify-start gap-2", collapsed && "px-0 justify-center")}
          onClick={() => setReflection(true)}
          title={t(lang, "sidebar.reflectAria")}
        >
          <Sunset className="size-4" />
          {!collapsed && <span>{t(lang, "sidebar.reflect")}</span>}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <SortableContext
            items={orderedLinks.map((l) => l.href)}
            strategy={verticalListSortingStrategy}
          >
            <div>
              {orderedLinks.map((link) => (
                <SortableLink
                  key={link.href}
                  link={link}
                  active={pathname === link.href}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

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
                {/* Drag-to-reorder lists. PointerSensor 5px activation
                    keeps regular clicks navigating; only an actual drag
                    triggers reorder. The reorder hook updates the
                    cache optimistically so rows don't snap back. */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                  onDragEnd={(e: DragEndEvent) => {
                    const { active, over } = e;
                    if (!over || active.id === over.id) return;
                    const ids = projects.map((p) => p.id);
                    const oldIdx = ids.indexOf(String(active.id));
                    const newIdx = ids.indexOf(String(over.id));
                    if (oldIdx < 0 || newIdx < 0) return;
                    const next = arrayMove(ids, oldIdx, newIdx);
                    reorderProjects.mutate(next);
                  }}
                >
                  <SortableContext
                    items={projects.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {projects.map((p) => (
                      <SortableSidebarList
                        key={p.id}
                        project={p}
                        active={pathname === `/app/lists/${p.id}`}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                {projects.length === 0 && (
                  <p className="text-xs text-muted-fg px-2">{t(lang, "sidebar.noLists")}</p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between px-2 mb-1.5">
                <span className="editorial-number text-[10px] uppercase tracking-[0.18em]">{t(lang, "sidebar.tags")}</span>
              </div>
              <div className="flex flex-wrap gap-1 px-2">
                {tags.map((tag) => (
                  <SidebarTagItem
                    key={tag.id}
                    tag={tag}
                    active={pathname === `/app/tags/${encodeURIComponent(tag.name)}`}
                  />
                ))}
                {tags.length === 0 && (
                  <p className="text-xs text-muted-fg w-full">{t(lang, "sidebar.noTags")}</p>
                )}
              </div>
            </div>
          </>
        )}
      </nav>

      <div className="border-t border-border p-2 flex items-center gap-2">
        <NotificationBell collapsed={collapsed} />
        <button
          className={cn("btn-ghost size-9 p-0 grid place-items-center", collapsed && "mx-auto")}
          onClick={() =>
            setTheme((resolvedTheme ?? theme) === "dark" ? "light" : "dark")
          }
          title={t(lang, "sidebar.toggleTheme")}
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

/** A single sortable nav link. The whole row is the drag handle —
 *  PointerSensor activation distance (5px) keeps clicks navigating
 *  while real drags reorder. A subtle GripVertical fades in on hover
 *  to advertise the affordance. */
function SortableLink({
  link,
  active,
  collapsed,
}: {
  link: LinkDef;
  active: boolean;
  collapsed: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.href });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  const Icon = link.icon;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative",
        isDragging && "cursor-grabbing"
      )}
    >
      <Link
        href={link.href}
        className={cn(
          "flex items-center gap-2 h-9 px-2 rounded-md text-sm select-none",
          active ? "bg-muted text-fg" : "text-muted-fg hover:bg-muted hover:text-fg",
          collapsed && "justify-center"
        )}
        title={link.label}
        // Block default drag (which would offer to drag the URL) so only
        // dnd-kit's pointer events drive reordering.
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed && <span className="truncate flex-1">{link.label}</span>}
        {!collapsed && (
          <GripVertical className="size-3.5 text-muted-fg/0 group-hover:text-muted-fg/60 transition-colors shrink-0" />
        )}
      </Link>
    </div>
  );
}

/**
 * Sortable wrapper around SidebarListItem. Drag listeners attach to a
 * thin invisible overlay so the inner Link + ⋯ menu button still
 * receive their own clicks. PointerSensor's 5px activation distance
 * lets short pointerup events fall through to the underlying Link.
 */
function SortableSidebarList({
  project,
  active,
}: {
  project: Project;
  active: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  // Listeners go on the wrapper itself — same pattern as SortableLink
  // for the top-nav rows (Today, Tomorrow, …). PointerSensor's 5px
  // activation distance lets a short click pass through to the inner
  // Link or the ⋯ menu button without ever starting a drag. No
  // overlay required, so the cursor + hover affordances behave
  // identically to the other rows.
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
    >
      <SidebarListItem project={project} active={active} />
      {/* Hover-revealed grip dot — sits in the gap between the title
          and the ⋯ menu button (which lives at right-1) so the two
          never collide. Matches SortableLink's affordance. */}
      <GripVertical
        className="absolute top-1/2 right-7 -translate-y-1/2 size-3.5 text-muted-fg/0 group-hover:text-muted-fg/60 transition-colors pointer-events-none"
        aria-hidden
      />
    </div>
  );
}
