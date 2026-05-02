"use client";
import { TaskListView } from "@/components/app/task-list-view";

export default function InboxPage() {
  return (
    <TaskListView
      title="Inbox"
      subtitle="Every active task, across every list."
      filter={{ view: "all" }}
      groupByDate
    />
  );
}
