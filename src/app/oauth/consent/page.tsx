import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: { authorization_id?: string };
}) {
  const authorizationId = searchParams.authorization_id;
  if (!authorizationId) {
    return (
      <main className="min-h-screen grid place-items-center px-6">
        <div className="card w-full max-w-lg p-8 space-y-4">
          <h1 className="font-display text-2xl tracking-tight">Authorization request missing</h1>
          <p className="text-sm text-muted-fg">
            This page must be opened from a valid Biz Vault connection request.
          </p>
          <Link href="/" className="text-accent hover:underline">
            Return to First Light
          </Link>
        </div>
      </main>
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const returnTo = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  const { data: details, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);

  if (error || !details) {
    return (
      <main className="min-h-screen grid place-items-center px-6">
        <div className="card w-full max-w-lg p-8 space-y-4">
          <h1 className="font-display text-2xl tracking-tight">Authorization request expired</h1>
          <p className="text-sm text-muted-fg">
            {error?.message ?? "The authorization request is no longer valid."}
          </p>
          <p className="text-xs text-muted-fg">
            Return to ChatGPT and start the Biz Vault connection again.
          </p>
        </div>
      </main>
    );
  }

  if (!("authorization_id" in details)) {
    redirect(details.redirect_url);
  }

  const scopes = (details.scope ?? "")
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="card w-full max-w-xl p-8 space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-fg">First Light OAuth</p>
          <h1 className="font-display text-2xl tracking-tight">
            Connect {details.client?.name ?? "ChatGPT"} to Biz Vault
          </h1>
          <p className="text-sm text-muted-fg leading-relaxed">
            This grants the connected ChatGPT app access to the Biz Vault data already available
            to your signed-in First Light account. It does not grant access to your password.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-fg">Connected account</p>
            <p className="text-sm font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-fg">Application</p>
            <p className="text-sm font-medium">{details.client?.name ?? "ChatGPT"}</p>
          </div>
          {scopes.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-fg">Requested permissions</p>
              <ul className="mt-1 text-sm text-muted-fg list-disc pl-5">
                {scopes.map((scope) => (
                  <li key={scope}>{scope}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <form action="/api/oauth/decision" method="post" className="flex gap-3">
          <input type="hidden" name="authorization_id" value={authorizationId} />
          <button
            type="submit"
            name="decision"
            value="approve"
            className="btn-primary flex-1"
          >
            Connect Biz Vault
          </button>
          <button
            type="submit"
            name="decision"
            value="deny"
            className="btn-outline flex-1"
          >
            Cancel
          </button>
        </form>

        <p className="text-xs text-muted-fg leading-relaxed">
          You can revoke this connection later from your authorized-app settings.
        </p>
      </div>
    </main>
  );
}
