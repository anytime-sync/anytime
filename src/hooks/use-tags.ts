"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tag } from "@/lib/db.types";

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tag[];
    },
  });
}

export function useUpsertTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string }) => {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("tags")
        .upsert(
          { user_id: u.user.id, name: input.name, color: input.color ?? "#6b7280" },
          { onConflict: "user_id,name" }
        )
        .select()
        .single();
      if (error) throw error;
      return data as Tag;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

/**
 * Attach an existing or new tag (by name) to a task. The tag row is upserted
 * by (user_id, name), then a row in task_tags is inserted (idempotent via
 * the (task_id, tag_id) PK).
 */
export function useAddTaskTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; name: string; color?: string }) => {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const name = input.name.trim().replace(/^#/, "");
      if (!name) throw new Error("Tag name is empty");

      const { data: tag, error: tErr } = await supabase
        .from("tags")
        .upsert(
          { user_id: u.user.id, name, color: input.color ?? "#6b7280" },
          { onConflict: "user_id,name" }
        )
        .select()
        .single();
      if (tErr) throw tErr;

      const { error: linkErr } = await supabase
        .from("task_tags")
        .upsert(
          { task_id: input.taskId, tag_id: tag.id },
          { onConflict: "task_id,tag_id", ignoreDuplicates: true }
        );
      if (linkErr) throw linkErr;
      return tag as Tag;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task", v.taskId] });
    },
  });
}

export function useRemoveTaskTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; tagId: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("task_tags")
        .delete()
        .eq("task_id", input.taskId)
        .eq("tag_id", input.tagId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task", v.taskId] });
    },
  });
}
