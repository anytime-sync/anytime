"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Hooks for the per-user inbound-email alias.
 *
 * The alias is the local-part — the UI renders
 * `${alias_local}@firstlight.to`. POST creates or rotates the alias
 * (the API upserts a row keyed by user_id), GET returns the row or
 * null.
 */

export type InboxAliasRow = {
  user_id: string;
  alias_local: string;
  default_list_id: string | null;
  created_at: string;
  last_received_at: string | null;
  total_received: number;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* noop */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export function useInboxAlias() {
  return useQuery({
    queryKey: ["inboxAlias"],
    queryFn: async () => {
      const j = await fetchJson<{ row: InboxAliasRow | null }>(
        "/api/inbox-alias"
      );
      return j.row;
    },
  });
}

export function useRotateInboxAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const j = await fetchJson<{ row: InboxAliasRow }>("/api/inbox-alias", {
        method: "POST",
      });
      return j.row;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inboxAlias"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
