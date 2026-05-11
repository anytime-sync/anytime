"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sliders, Users, Brush } from "lucide-react";

/**
 * /app/admin/* shared layout — a thin sub-nav that links the three
 * admin surfaces (feature flags, members, design) so the owner can
 * move between them without typing URLs.
 */
const TABS = [
  { href: "/app/admin",         label: "Feature flags", Icon: Sliders, match: "exact" },
  { href: "/app/admin/members", label: "Members",       Icon: Users,   match: "prefix" },
  { href: "/app/admin/design",  label: "Design (CMS)",  Icon: Brush,   match: "prefix" },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="flex flex-col h-full">
      <nav className="px-4 md:px-6 pt-4 pb-2 flex items-center gap-1 border-b border-border">
        {TABS.map(({ href, label, Icon, match }) => {
          const active =
            match === "exact" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "h-8 px-3 inline-flex items-center gap-1.5 text-xs rounded-md transition-colors",
                active
                  ? "bg-accent/15 text-accent font-medium"
                  : "text-muted-fg hover:bg-surface-2 hover:text-fg"
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}
