"use client";

import { useQuery } from "@tanstack/react-query";

export type ActivityKind =
  | "task_created"
  | "task_completed"
  | "task_reopened"
  | "task_assigned"
  | "task_shared"
  | "task_deleted"
  | "task_commented";

export type ActivityActor = {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
};

export type ActivityPayload = {
  title?: string;
  preview?: string;
  assignee_id?: string;
  [k: string]: unknown;
};

export type ActivityRow = {
  id: string;
  group_id: string;
  actor_id: string;
  kind: ActivityKind | string;
  payload: ActivityPayload | null;
  task_id: string | null;
  created_at: string;
  actor: ActivityActor | null;
};

/**
 * Polling-based activity feed. 60s feels live enough without the
 * websocket overhead, and the trigger writes are append-only so a
 * stale list just means you see a row a few seconds late.
 */
export function useGroupActivity(groupId: string | null | undefined) {
  return useQuery({
    enabled: !!groupId,
    queryKey: ["groupActivity", groupId],
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!groupId) return [] as ActivityRow[];
      const res = await fetch(`/api/share-groups/${groupId}/activity`);
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
      const j = (await res.json()) as { rows: ActivityRow[] };
      return j.rows ?? [];
    },
  });
}
