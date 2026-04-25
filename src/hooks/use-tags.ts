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
