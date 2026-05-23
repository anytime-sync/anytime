"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isAdminEmail } from "@/lib/admin";

/**
 * Client-side belt-and-suspenders for the server-rendered admin gate.
 * The admin layout already redirects non-admins server-side, but cookies
 * are shared across tabs, so switching to a non-admin account in another
 * tab won't re-run that guard on an already-mounted admin page. This
 * re-verifies on mount and on every auth-state change, hides the admin
 * chrome the instant the session is not the owner's, and redirects to /app.
 * serverEmail is what the server already verified for this render, so the
 * legitimate admin sees no flash.
 */
export function AdminGuard({
  children,
  serverEmail,
}: {
  children: React.ReactNode;
  serverEmail: string | null;
}) {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean>(isAdminEmail(serverEmail));

  useEffect(() => {
    const sb = createClient();
    let active = true;
    const evaluate = (email?: string | null) => {
      if (!active) return;
      const ok = isAdminEmail(email);
      setAllowed(ok);
      if (!ok) router.replace("/app");
    };
    sb.auth.getUser().then(({ data }) => evaluate(data.user?.email));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) =>
      evaluate(session?.user?.email)
    );
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (!allowed) return null;
  return <>{children}</>;
}
