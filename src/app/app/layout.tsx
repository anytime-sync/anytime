import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next"; import { AppShell } from "@/components/app/app-shell"; export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true, noimageindex: true, googleBot: { index: false, follow: false, nosnippet: true } } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <AppShell user={{ id: user.id, email: user.email ?? "", name: profile?.full_name ?? null }}>
      {children}
    </AppShell>
  );
}
