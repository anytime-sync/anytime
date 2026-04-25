"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export type ProjectMember = {
  project_id: string;
  user_id: string;
  role: "owner" | "member" | "viewer";
  added_at: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
};

export function useProjectMembers(projectId: string | null) {
  return useQuery({
    enabled: !!projectId,
    queryKey: ["project_members", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("project_members")
        .select("project_id, user_id, role, added_at")
        .eq("project_id", projectId)
        .order("added_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as ProjectMember[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length === 0) return rows;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .in("id", ids);
      const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return rows.map((r) => {
        const p = map.get(r.user_id) as any;
        return { ...r, email: p?.email ?? null, full_name: p?.full_name ?? null, avatar_url: p?.avatar_url ?? null };
      });
    },
  });
}

export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, email, role = "member" }: { projectId: string; email: string; role?: ProjectMember["role"] }) => {
      const supabase = createClient();
      // Use the security-definer RPC so we can find a user by email without exposing the profiles table.
      const { data, error } = await supabase.rpc("find_profile_by_email", { p_email: email.trim() });
      if (error) throw error;
      const found = (data ?? [])[0] as { id: string; email: string } | undefined;
      if (!found) {
        throw new Error("No Anytime account with that email yet — ask them to sign up first.");
      }
      const { error: insErr } = await supabase
        .from("project_members")
        .insert({ project_id: projectId, user_id: found.id, role });
      if (insErr) throw insErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project_members"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, userId }: { projectId: string; userId: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project_members"] }),
  });
}
