"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Task, Tag } from "@/lib/db.types";
import { toast } from "sonner";
import { rrulestr } from "rrule";

export type TaskWithTags = Task & { tags: Tag[] };

export type TasksFilter = {
  view?: "today" | "tomorrow" | "next7" | "inbox" | "all";
  projectId?: string | null;
  tagName?: string;
  includeCompleted?: boolean;
};

export function useTasks(filter: TasksFilter = {}) {
  return useQuery({
    queryKey: ["tasks", filter],
    queryFn: async () => {
      const supabase = createClient();
      let q = supabase
        .from("tasks")
        .select("*, task_tags ( tag_id, tags ( id, user_id, name, color, parent_id, created_at ) )")
        .order("priority", { ascending: false })
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      // Top-level tasks only — subtasks are loaded via useSubtasks(parentId).
      q = q.is("parent_id", null);

      if (!filter.includeCompleted) q = q.eq("is_completed", false);
      if (filter.projectId !== undefined) {
        if (filter.projectId === null) q = q.is("project_id", null);
        else q = q.eq("project_id", filter.projectId);
      }
      if (filter.view === "inbox") q = q.is("project_id", null);

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
      const endOfTomorrow = new Date(startOfTomorrow);
      endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
      const endOf7 = new Date(startOfToday);
      endOf7.setDate(endOf7.getDate() + 7);

      if (filter.view === "today") {
        q = q.lt("due_at", startOfTomorrow.toISOString());
      } else if (filter.view === "tomorrow") {
        q = q
          .gte("due_at", startOfTomorrow.toISOString())
          .lt("due_at", endOfTomorrow.toISOString());
      } else if (filter.view === "next7") {
        q = q.lt("due_at", endOf7.toISOString());
      }

      const { data, error } = await q;
      if (error) throw error;

      let tasks = (data ?? []).map((row: any) => {
        const tags = (row.task_tags ?? [])
          .map((tt: any) => tt.tags)
          .filter(Boolean) as Tag[];
        const { task_tags, ...rest } = row;
        return { ...(rest as Task), tags } as TaskWithTags;
      });

      if (filter.tagName) {
        tasks = tasks.filter((t) =>
          t.tags.some((tg) => tg.name.toLowerCase() === filter.tagName!.toLowerCase())
        );
      }
      return tasks;
    },
  });
}

export function useSubtasks(parentId: string | null) {
  return useQuery({
    enabled: !!parentId,
    queryKey: ["subtasks", parentId],
    queryFn: async () => {
      if (!parentId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("parent_id", parentId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

export function useSubtaskCounts(parentIds: string[]) {
  return useQuery({
    enabled: parentIds.length > 0,
    queryKey: ["subtaskCounts", [...parentIds].sort()],
    queryFn: async () => {
      if (!parentIds.length) return {} as Record<string, { total: number; done: number }>;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .select("parent_id, is_completed")
        .in("parent_id", parentIds);
      if (error) throw error;
      const counts: Record<string, { total: number; done: number }> = {};
      for (const row of (data ?? []) as Pick<Task, "parent_id" | "is_completed">[]) {
        const key = row.parent_id!;
        counts[key] ??= { total: 0, done: 0 };
        counts[key].total += 1;
        if (row.is_completed) counts[key].done += 1;
      }
      return counts;
    },
  });
}

export function useTask(id: string | null) {
  return useQuery({
    enabled: !!id,
    queryKey: ["task", id],
    queryFn: async () => {
      if (!id) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tasks")
        .select("*, task_tags ( tag_id, tags ( * ) )")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const tags = ((data as any).task_tags ?? []).map((tt: any) => tt.tags).filter(Boolean) as Tag[];
      const { task_tags, ...rest } = data as any;
      return { ...(rest as Task), tags } as TaskWithTags;
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Task> & { title: string; tagNames?: string[] }) => {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");

      const { tagNames, ...taskInput } = input;
      const { data: task, error } = await supabase
        .from("tasks")
        .insert({ ...taskInput, user_id: u.user.id })
        .select()
        .single();
      if (error) throw error;

      if (tagNames && tagNames.length) {
        // upsert tags then link
        const rows = tagNames.map((name) => ({ user_id: u.user!.id, name }));
        const { data: tags, error: tagErr } = await supabase
          .from("tags")
          .upsert(rows, { onConflict: "user_id,name" })
          .select();
        if (tagErr) throw tagErr;
        const links = (tags ?? []).map((t: any) => ({ task_id: task.id, tag_id: t.id }));
        if (links.length) {
          const { error: linkErr } = await supabase.from("task_tags").insert(links);
          if (linkErr) throw linkErr;
        }
      }
      return task as Task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdate