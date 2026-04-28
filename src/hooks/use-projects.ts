"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/db.types";
import { toast } from "sonner";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("is_archived", false)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string; emoji?: string | null }) => {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("projects")
        .insert({
          user_id: u.user.id,
          name: input.name,
          color: input.color ?? "#4772fa",
          emoji: input.emoji ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<Project> & { id: string }) => {
      const supabase = createClient();
      const { id, ...rest } = p;
      const { error } = await supabase.from("projects").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

/**
 * Reorder the user's lists. Takes the new ordered array of project ids
 * and updates each project's `position` to its new index * 1000 (the
 * gap leaves room for future single-item inserts without a full
 * re-write). The cache is updated optimistically so the sidebar
 * doesn't snap back while the writes round-trip.
 */
export function useReorderProjects() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const supabase = createClient();
      for (let i = 0; i < orderedIds.length; i++) {
        const { error } = await supabase
          .from("projects")
          .update({ position: i * 1000 })
          .eq("id", orderedIds[i]!);
        if (error) throw error;
      }
    },
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: ["projects"] });
      const prev = qc.getQueryData<Project[]>(["projects"]);
      if (prev) {
        const byId = new Map(prev.map((p) => [p.id, p]));
        const reordered = orderedIds
          .map((id, i) => {
            const p = byId.get(id);
            return p ? { ...p, position: i * 1000 } : null;
          })
          .filter((p): p is Project => !!p);
        qc.setQueryData<Project[]>(["projects"], reordered);
      }
      return { prev };
    },
    onError: (e: Error, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(["projects"], ctx.prev);
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
