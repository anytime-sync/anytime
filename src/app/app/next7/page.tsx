"use client";
import { TaskListView } from "@/components/app/task-list-view";

export default function Next7Page() {
  return (
    <TaskListView
      title="Next 7 Days"
      subtitle="Tasks due within the next week."
      filter={{ view: "next7" }}
    />
  );
}
