"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Habit, HabitLog } from "@/lib/db.types";
import { toast } from "sonner";

export function useHabits() {
  return useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .eq("is_archived", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Habit[];
    },
  });
}

export function useHabitLogs(rangeStart: string, rangeEnd: string) {
  return useQuery({
    queryKey: ["habit_logs", rangeStart, rangeEnd],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("habit_logs")
        .select("*")
        .gte("log_date", rangeStart)
        .lte("log_date", rangeEnd);
      if (error) throw error;
      return (data ?? []) as HabitLog[];
    },
  });
}

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Habit> & { name: string }) => {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { error } = await supabase.from("habits").insert({ ...input, user_id: u.user.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleHabitLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ habitId, dateIso, current }: { habitId: string; dateIso: string; current?: HabitLog }) => {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      if (current) {
        const { error } = await supabase.from("habit_logs").delete().eq("id", current.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("habit_logs").insert({
          user_id: u.user.id,
          habit_id: habitId,
          log_date: dateIso,
          count: 1,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habit_logs"] }),
  });
}
