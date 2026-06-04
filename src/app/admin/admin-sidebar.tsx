"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users, BarChart3, FileText, Home, Palette, Tags, ToggleLeft,
  CreditCard, Mail, Megaphone, DollarSign, Paintbrush,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/* ── Dedicated admin sidebar state (separate from app sidebar) ── */

const useAdminSidebar = create<{
  collapsed: boolean;
  toggle: () => void;
}>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    { name: "fl.admin-sidebar" }
  )
);

/* ── Nav items ── */

const navItems = [
  { kicker: "01", href: "/admin", label: "Overview", icon: Home },
  { kicker: "02", href: "/admin/members", label: "Members", icon: Users },
  { kicker: "03", href: "/admin/feature-flags", label: "Feature flags", icon: ToggleLeft },
  { kicker: "04", href: "/admin/service-price", label: "Service Price", icon: DollarSign },
  { kicker: "05", href: "/admin/insights", label: "Insights", icon: BarChart3 },
  { kicker: "06", href: "/admin/content", label: "Content", icon: FileText },
  { kicker: "07", href: "/admin/design", label: "Design", icon: Palette },
  { kicker: "08", href: "/admin/keywords", label: "Keywords", icon: Tags },
  { kicker: "09", href: "/admin/billing", label: "Billing", icon: CreditCard },
  { kicker: "10", href: "/admin/newsletter", label: "Newsletter", icon: Mail },
  { kicker: "11", href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { kicker: "12", href: "/admin/format", label: "Format", icon: Paintbrush },
];

/* ── Sunburst SVG (unchanged from original layout) ── */

function SmallSun({ className }: { className?: string }) {
  const rays = [
    [0,2],[7.5,14],[15,6],[22.5,20],[30,0],[37.5,16],[45,9],[52.5,18],
    [60,3],[67.5,13],[75,7],[82.5,22],[90,0],[97.5,15],[105,10],[112.5,19],
    [120,5],[127.5,17],[135,8],[142.5,21],[150,1],[157.5,13],[165,11],[172.5,16],
    [180,4],[187.5,19],[195,9],[202.5,14],[210,2],[217.5,18],[225,10],[232.5,21],
    [240,6],[247.5,15],[255,7],[262.5,23],[270,3],[277.5,14],[285,11],[292.5,20],
    [300,5],[307.5,19],[315,10],[322.5,16],[330,2],[337.5,21],[345,8],[352.5,14],
  ];
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" stroke="currentColor"
      strokeWidth="0.7" strokeLinecap="butt" aria-hidden>
      <defs>
        <radialGradient id="fl-sun-fade" cx="32" cy="32" r="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="black" />
          <stop offset="22%" stopColor="black" />
          <stop offset="55%" stopColor="white" />
          <stop offset="100%" stopColor="white" />
        </radialGradient>
        <mask id="fl-sun-fade-mask">
          <rect width="64" height="64" fill="url(#fl-sun-fade)" />
        </mask>
      </defs>
      <g mask="url(#fl-sun-fade-mask)">
        {rays.map(([angle, y2]) => (
          <line key={angle} x1="32" y1="32" x2="32" y2={y2}
            transform={`rotate(${angle} 32 32)`} />
        ))}
      </g>
    </svg>
  );
}

/* ── Admin sidebar component ── */

export function AdminSidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useAdminSidebar();

  return (
    <aside
      className={cn(
        "shrink-0 border-r border-border flex flex-col surface transition-[width] duration-200",
        collapsed ? "w-[60px]" : "w-64"
      )}
    >
      {/* Header with wordmark + collapse toggle */}
      <div className="relative px-6 pt-8 pb-6 border-b border-border">
        <Link href="/admin" className="flex items-center gap-2.5">
          <SmallSun className="size-5 text-accent shrink-0" />
          {!collapsed && (
            <span className="wordmark text-base">First Light</span>
          )}
        </Link>
        {!collapsed && (
          <p className="editorial-number text-[10px] mt-3 ml-[1.875rem]">
            The Admin Edition
          </p>
        )}
        <button
          onClick={toggle}
          className="btn-ghost h-7 w-7 p-0 grid place-items-center absolute right-2 top-4"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-6 space-y-1">
        {navItems.map(({ kicker, href, label, icon: Icon }) => {
          const active =
            href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "group flex items-center gap-3 h-10 rounded-md text-sm transition-colors",
                collapsed ? "justify-center px-0" : "px-2",
                active
                  ? "bg-muted text-fg"
                  : "hover:bg-muted/60"
              )}
            >
              {!collapsed && (
                <span className="editorial-number text-[10px] w-5 shrink-0 group-hover:text-accent transition-colors">
                  {kicker}
                </span>
              )}
              <Icon
                className={cn(
                  "size-4 transition-colors",
                  active
                    ? "text-fg"
                    : "text-muted-fg group-hover:text-fg"
                )}
              />
              {!collapsed && (
                <span
                  className={cn(
                    "transition-colors",
                    active ? "text-fg" : "group-hover:text-fg"
                  )}
                >
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-5 border-t border-border">
        <Link
          href="/app"
          className="text-xs text-muted-fg hover:text-fg inline-flex items-center gap-1.5 transition-colors"
          title="Back to the app"
        >
          <span aria-hidden>←</span>
          {!collapsed && "Back to the app"}
        </Link>
        {!collapsed && (
          <p className="text-[10px] text-muted-fg/70 mt-3 italic font-display">
            For the keeper of the light.
          </p>
        )}
      </div>
    </aside>
  );
}
