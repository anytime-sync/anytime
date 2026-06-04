import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { AdminGuard } from "./admin-guard";
import { AdminSidebar } from "./admin-sidebar";

/**
 * Admin layout — server-rendered auth gate + client-side collapsible sidebar.
 *
 * The sidebar is extracted to a client component (AdminSidebar) so it can
 * use Zustand state for collapse/expand, persisted in localStorage.
 * The server layout handles auth gating only.
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

  return (
    <AdminGuard serverEmail={user.email ?? null}>
      <div className="min-h-screen flex bg-bg text-fg">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </AdminGuard>
  );
}
