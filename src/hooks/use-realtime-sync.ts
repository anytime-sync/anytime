"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("realtime-app")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
        qc.invalidateQueries({ queryKey: ["task"] });
        qc.invalidateQueries({ queryKey: ["subtasks"] });
        qc.invalidateQueries({ queryKey: ["subtaskCounts"] });
        qc.invalidateQueries({ queryKey: ["upcoming-reminders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => {
        qc.invalidateQueries({ queryKey: ["projects"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "project_members" }, () => {
        qc.invalidateQueries({ queryKey: ["project_members"] });
        qc.invalidateQueries({ queryKey: ["projects"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tags" }, () => {
        qc.invalidateQueries({ queryKey: ["tags"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_tags" }, () => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_attachments" }, () => {
        qc.invalidateQueries({ queryKey: ["task_attachments"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "habits" }, () => {
        qc.invalidateQueries({ queryKey: ["habits"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "habit_logs" }, () => {
        qc.invalidateQueries({ queryKey: ["habit_logs"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pomodoro_sessions" }, () => {
        qc.invalidateQueries({ queryKey: ["pomodoro_sessions"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
