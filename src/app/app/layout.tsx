import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true, noimageindex: true, googleBot: { index: false, follow: false, nosnippet: true } } };

/**
 * Deduplicate the profile fetch within a single request tree.
 * React's `cache()` ensures that if the layout and any server action/
 * page both call getAuthUser(), only ONE round-trip to Supabase fires.
 * This eliminates the extra latency that caused the white-screen flash
 * on client-side navigation between /app/* routes.
 */
const getAuthUser = cache(async () => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
});

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const result = await getAuthUser();
  if (!result) redirect("/login");

  const { user, profile } = result;

  return (
    <AppShell user={{ id: user.id, email: user.email ?? "", name: profile?.full_name ?? null }}>
      {children}
    </AppShell>
  );
}
