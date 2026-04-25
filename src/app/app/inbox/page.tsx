"use client";
import { TaskListView } from "@/components/app/task-list-view";

export default function InboxPage() {
  return (
    <TaskListView
      title="Inbox"
      subtitle="Tasks not assigned to a list."
      filter={{ view: "inbox" }}
      defaults={{ project_id: null }}
    />
  );
}
