"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type CommentAuthor = {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
};

export type TaskComment = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: CommentAuthor | null;
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

export function useTaskComments(taskId: string | null | undefined) {
  return useQuery({
    enabled: !!taskId,
    queryKey: ["taskComments", taskId],
    queryFn: async () => {
      if (!taskId) return [] as TaskComment[];
      const j = await fetchJson<{ rows: TaskComment[] }>(
        `/api/tasks/${taskId}/comments`
      );
      return j.rows ?? [];
    },
  });
}

export function useAddComment(taskId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      if (!taskId) throw new Error("no_task");
      const j = await fetchJson<{ row: TaskComment }>(
        `/api/tasks/${taskId}/comments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body }),
        }
      );
      return j.row;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taskComments", taskId] });
      // Mentions may have produced an app_notifications row; nudge the bell.
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateComment(taskId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      commentId,
      body,
    }: {
      commentId: string;
      body: string;
    }) => {
      if (!taskId) throw new Error("no_task");
      const j = await fetchJson<{ row: TaskComment }>(
        `/api/tasks/${taskId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body }),
        }
      );
      return j.row;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["taskComments", taskId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteComment(taskId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!taskId) throw new Error("no_task");
      await fetchJson<{ ok: true }>(
        `/api/tasks/${taskId}/comments/${commentId}`,
        { method: "DELETE" }
      );
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["taskComments", taskId] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
