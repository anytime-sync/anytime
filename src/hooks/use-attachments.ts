"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export type TaskAttachment = {
  id: string;
  task_id: string;
  user_id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  // Signed URL added at runtime.
  url?: string;
};

const BUCKET = "attachments";

export function useTaskAttachments(taskId: string | null) {
  return useQuery({
    enabled: !!taskId,
    queryKey: ["task_attachments", taskId],
    queryFn: async () => {
      if (!taskId) return [] as TaskAttachment[];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as TaskAttachment[];
      // Generate short-lived signed URLs in parallel.
      const signed = await Promise.all(
        rows.map(async (r) => {
          const { data: s } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(r.storage_path, 60 * 60); // 1h
          return { ...r, url: s?.signedUrl };
        })
      );
      return signed;
    },
  });
}

export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) => {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");

      const safeName = file.name.replace(/[^\w.\-()\s]/g, "_");
      const path = `${u.user.id}/${taskId}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("task_attachments").insert({
        task_id: taskId,
        user_id: u.user.id,
        storage_path: path,
        filename: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (insErr) {
        // Clean up the orphan blob if the row insert failed.
        await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
        throw insErr;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["task_attachments", vars.taskId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: TaskAttachment) => {
      const supabase = createClient();
      const { error: delDb } = await supabase
        .from("task_attachments")
        .delete()
        .eq("id", a.id);
      if (delDb) throw delDb;
      await supabase.storage.from(BUCKET).remove([a.storage_path]).catch(() => {});
    },
    onSuccess: (_, a) => {
      qc.invalidateQueries({ queryKey: ["task_attachments", a.task_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function formatBytes(n: number | null | undefined): string {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
