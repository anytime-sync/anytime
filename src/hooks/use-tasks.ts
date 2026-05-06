"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Task, Tag } from "@/lib/db.types";
import { toast } from "sonner";
import { rrulestr } from "rrule";

export type TaskWithTags = Task & { tags: Tag[] };

export type TasksFilter = {
  view?: "today" | "tomorrow" | "next7" | "next90" | "inbox" | "completed" | "all";
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
        // User-set position is the primary order so drag-to-reorder sticks
        // across views. Tiebreakers preserve a sensible default for untouched
        // lists (where everyone shares position=0).
        .order("position", { ascending: true })
        .order("priority", { ascending: false })
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      // Top-level tasks only — subtasks are loaded via useSubtasks(parentId).
      q = q.is("parent_id", null);

      // The 'completed' view is the only one that flips the polarity of
      // is_completed — every other view filters out completed tasks
      // unless includeCompleted was explicitly passed.
      if (filter.view === "completed") {
        q = q
          .eq("is_completed", true)
          .order("completed_at", { ascending: false });
      } else if (!filter.includeCompleted) {
        q = q.eq("is_completed", false);
      }

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
      const endOf90 = new Date(startOfToday);
      endOf90.setDate(endOf90.getDate() + 90);

      if (filter.view === "today") {
        q = q.lt("due_at", startOfTomorrow.toISOString());
      } else if (filter.view === "tomorrow") {
        q = q.gte("due_at", startOfTomorrow.toISOString()).lt("due_at", endOfTomorrow.toISOString());
      } else if (filter.view === "next7") {
        q = q.lt("due_at", endOf7.toISOString());
      } else if (filter.view === "next90") {
        q = q.lt("due_at", endOf90.toISOString());
      }

      const { data, error } = await q;
      if (error) throw error;

      let tasks = (data ?? []).map((row: any) => {
        const tags = (row.task_tags ?? []).map((tt: any) => tt.tags).filter(Boolean) as Tag[];
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
      // Strip the synthetic optimistic id (if the caller passed one) before
      // hitting Postgres — the DB assigns the real uuid.
      delete (taskInput as any).id;
      const { data: task, error } = await supabase
        .from("tasks")
        .insert({ ...taskInput, user_id: u.user.id })
        .select()
        .single();
      if (error) throw error;

      if (tagNames && tagNames.length) {
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
    /**
     * Optimistic insert — the new task appears in every visible list
     * the instant the user hits Enter, before the server responds.
     * The server roundtrip (~200-500ms) becomes invisible. Any error
     * rolls back to the prior list and surfaces a toast.
     */
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueriesData<TaskWithTags[]>({ queryKey: ["tasks"] });
      const tempId =
        (input as any).id ?? `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      const optimistic: TaskWithTags = {
        id: tempId,
        user_id: "optimistic",
        project_id: input.project_id ?? null,
        parent_id: input.parent_id ?? null,
        title: input.title,
        notes: input.notes ?? null,
        is_completed: false,
        completed_at: null,
        start_at: input.start_at ?? null,
        due_at: input.due_at ?? null,
        is_all_day: input.is_all_day ?? false,
        priority: (input.priority ?? 0) as any,
        position: 0,
        rrule: input.rrule ?? null,
        reminder_at: input.reminder_at ?? null,
        estimated_pomodoros: input.estimated_pomodoros ?? 0,
        spent_pomodoros: 0,
        created_at: now,
        updated_at: now,
        // Synthetic tags so the row renders pills immediately. They'll
        // be replaced by the real tag rows on the next refetch.
        tags: (input.tagNames ?? []).map((name, i) => ({
          id: `temp-tag-${i}-${name}`,
          user_id: "optimistic",
          name,
          color: null,
        })) as any,
      };
      qc.setQueriesData<TaskWithTags[]>({ queryKey: ["tasks"] }, (old) =>
        old ? [optimistic, ...old] : old
      );
      return { prev, tempId };
    },
    onError: (e: Error, _input, ctx) => {
      ctx?.prev.forEach(([key, val]) => qc.setQueryData(key, val));
      toast.error(e.message);
    },
    onSuccess: (createdTask) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["subtasks"] });
      qc.invalidateQueries({ queryKey: ["subtaskCounts"] });

      // Background AI: auto-triage (quadrant -> priority) + smart estimate.
      // Both fire-and-forget. They only run when the new task looks
      // meaningful enough to bother (>= 8 chars, no user-set priority,
      // no due date) — micro-tasks like "Eat" stay alone.
      try {
        if (
          createdTask &&
          createdTask.id &&
          createdTask.title &&
          createdTask.title.length >= 8 &&
          (createdTask.priority ?? 0) === 0 &&
          !createdTask.due_at
        ) {
          const id = createdTask.id;
          const title = createdTask.title;
          // Auto-triage: classify quadrant, map to priority + due_at if Q1/Q3.
          fetch("/api/ai/quadrant", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ title }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((j: any) => {
              if (!j || typeof j.quadrant !== "number") return;
              // Quadrant -> priority (Q1=5,Q2=5,Q3=1,Q4=0); Q1+Q3 also get end-of-day.
              const map: Record<number, { priority: 0 | 1 | 3 | 5; due_at: string | null }> = {
                1: { priority: 5, due_at: new Date(new Date().setHours(23, 59, 0, 0)).toISOString() },
                2: { priority: 5, due_at: null },
                3: { priority: 1, due_at: new Date(new Date().setHours(23, 59, 0, 0)).toISOString() },
                4: { priority: 0, due_at: null },
              };
              const target = map[j.quadrant];
              if (!target) return;
              createClient()
                .from("tasks")
                .update({ priority: target.priority, due_at: target.due_at })
                .eq("id", id)
                .then(() => qc.invalidateQueries({ queryKey: ["tasks"] }));
            })
            .catch(() => {});
          // Smart estimate.
          fetch("/api/ai/estimate-task", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ task_id: id, title }),
          })
            .then(() => qc.invalidateQueries({ queryKey: ["tasks"] }))
            .catch(() => {});
        }
      } catch {
        // never block the create flow
      }
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<Task> & { id: string }) => {
      const supabase = createClient();
      const { id, ...rest } = p;
      const { error } = await supabase.from("tasks").update(rest).eq("id", id);
      if (error) throw error;
    },
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueriesData<TaskWithTags[]>({ queryKey: ["tasks"] });
      qc.setQueriesData<TaskWithTags[]>({ queryKey: ["tasks"] }, (old) =>
        old?.map((t) => (t.id === p.id ? { ...t, ...p } : t))
      );
      return { prev };
    },
    onError: (_e, _p, ctx) => {
      ctx?.prev.forEach(([key, val]) => qc.setQueryData(key, val));
      toast.error("Update failed");
    },
    onSettled: (_d, _e, p) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task", p.id] });
      qc.invalidateQueries({ queryKey: ["subtasks"] });
      qc.invalidateQueries({ queryKey: ["subtaskCounts"] });
    },
  });
}

/** Compute next occurrence for a recurring task. Returns null if none. */
function nextOccurrence(task: Task): Date | null {
  if (!task.rrule || !task.due_at) return null;
  try {
    const dtstart = new Date(task.due_at);
    const rule = rrulestr(`DTSTART:${dtstart.toISOString().replace(/[-:]|\.\d{3}/g, "")}\nRRULE:${task.rrule}`);
    const next = rule.after(dtstart, false);
    return next ?? null;
  } catch {
    return null;
  }
}

export function useToggleTask() {
  const update = useUpdateTask();
  return (task: Task) => {
    if (!task.is_completed) {
      const next = nextOccurrence(task);
      if (next) {
        // Slide BOTH ends of the meeting window forward by the same
        // delta so the duration is preserved on the next occurrence.
        // Without this, only due_at advanced — start_at stayed pinned
        // to the very first occurrence, so a monthly meeting that
        // started 4/30 10:15 AM would render as "starts 4/30, ends
        // 5/30" after the first roll-over instead of "starts 5/30,
        // ends 5/30".
        const patch: Partial<Task> & { id: string } = {
          id: task.id,
          due_at: next.toISOString(),
        };
        if (task.start_at && task.due_at) {
          const delta =
            next.getTime() - new Date(task.due_at).getTime();
          patch.start_at = new Date(
            new Date(task.start_at).getTime() + delta
          ).toISOString();
        }
        update.mutate(patch);
        return;
      }
    }
    update.mutate({
      id: task.id,
      is_completed: !task.is_completed,
      completed_at: !task.is_completed ? new Date().toISOString() : null,
    });
  };
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["subtasks"] });
      qc.invalidateQueries({ queryKey: ["subtaskCounts"] });
    },
  });
}

/**
 * Batch-persist new task positions after a drag-to-reorder, with optimistic
 * UI so the list doesn't flash back to the old order.
 */
export function useReorderTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (changes: Array<{ id: string; position: number }>) => {
      if (changes.length === 0) return;
      const supabase = createClient();
      for (const c of changes) {
        const { error } = await supabase
          .from("tasks")
          .update({ position: c.position })
          .eq("id", c.id);
        if (error) throw error;
      }
    },
    onMutate: async (changes) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueriesData<TaskWithTags[]>({ queryKey: ["tasks"] });
      const map = new Map(changes.map((c) => [c.id, c.position]));
      qc.setQueriesData<TaskWithTags[]>({ queryKey: ["tasks"] }, (old) =>
        old
          ?.map((t) => (map.has(t.id) ? { ...t, position: map.get(t.id)! } : t))
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev.forEach(([k, v]) => qc.setQueryData(k, v));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
