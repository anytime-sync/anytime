import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { Users, BarChart3, FileText, Home } from "lucide-react";

/**
 * Admin layout — server-rendered auth gate + sidebar shell.
 *
 * Auth check happens server-side so non-admins never see the admin
 * markup. Anyone hitting /admin without the matching email is sent
 * straight to /app (the regular app shell).
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
    { href: "/admin", label: "Overview", icon: Home },
    { href: "/admin/members", label: "Members", icon: Users },
    { href: "/admin/insights", label: "Insights", icon: BarChart3 },
    { href: "/admin/content", label: "Content", icon: FileText },
  ];

  return (
    <div className="min-h-screen flex bg-bg text-fg">
      <aside className="w-56 shrink-0 border-r border-border flex flex-col">
        <div className="px-4 h-14 flex items-center border-b border-border">
          <Link href="/admin" className="font-display text-sm tracking-wider">
            FIRST LIGHT · ADMIN
          </Link>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 h-9 rounded-md text-sm hover:bg-muted text-fg"
            >
              <Icon className="size-4 text-muted-fg" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-border text-xs text-muted-fg">
          <Link href="/app" className="hover:text-fg">
            ← Back to app
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
