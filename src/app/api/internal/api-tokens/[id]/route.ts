/**
 * DELETE /api/internal/api-tokens/{id}
 *   Revoke (soft-delete) a PAT owned by the authenticated user.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { revokePAT } from "@/lib/pat";

type Params = { params: { id: string } };

export async function DELETE(_req: Request, { params }: Params) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookies().get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await revokePAT({ tokenId: params.id, userId: user.id });
  return NextResponse.json({ revoked: true });
}

