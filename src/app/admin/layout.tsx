import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { Users, BarChart3, FileText, Home } from "lucide-react";

/**
 * Admin layout — server-rendered auth gate + editorial sidebar shell.
 *
 * Visual treatment matches the public landing: First Light wordmark with
 * a small sun glyph, a thin gold rule, and each nav item carries a
 * kicker number so the page reads like an editorial table of contents.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/app");

  const navItems = [
    { kicker: "01", href: "/admin",          label: "Overview", icon: Home       },
    { kicker: "02", href: "/admin/members",  label: "Members",  icon: Users      },
    { kicker: "03", href: "/admin/insights", label: "Insights", icon: BarChart3  },
    { kicker: "04", href: "/admin/content",  label: "Content",  icon: FileText   },
  ];

  return (
    <div className="min-h-screen flex bg-bg text-fg">
      <aside className="w-64 shrink-0 border-r border-border flex flex-col surface">
        <div className="px-6 pt-8 pb-6 border-b border-border">
          <Link href="/admin" className="flex items-center gap-2.5">
            <SmallSun className="size-5 text-accent shrink-0" />
            <span className="wordmark text-base">First Light</span>
          </Link>
          <p className="editorial-number text-[10px] mt-3 ml-[1.875rem]">
            The Admin Edition
          </p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map(({ kicker, href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 px-2 h-10 rounded-md text-sm hover:bg-muted/60 transition-colors"
            >
              <span className="editorial-number text-[10px] w-5 shrink-0 group-hover:text-accent transition-colors">
                {kicker}
              </span>
              <Icon className="size-4 text-muted-fg group-hover:text-fg transition-colors" />
              <span className="group-hover:text-fg transition-colors">
                {label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="px-6 py-5 border-t border-border">
          <Link
            href="/app"
            className="text-xs text-muted-fg hover:text-fg inline-flex items-center gap-1.5 transition-colors"
          >
            <span aria-hidden>←</span>
            Back to the app
          </Link>
          <p className="text-[10px] text-muted-fg/70 mt-3 italic font-display">
            For the keeper of the light.
          </p>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

function SmallSun({ className }: { className?: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="32" cy="32" r="7" />
      {rays.map((deg, i) => (
        <line
          key={i}
          x1="32"
          y1="18"
          x2="32"
          y2="13"
          transform={`rotate(${deg} 32 32)`}
        />
      ))}
    </svg>
  );
}
