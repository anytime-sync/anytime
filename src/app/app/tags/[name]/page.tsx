"use client";

import { useParams } from "next/navigation";
import { TaskListView } from "@/components/app/task-list-view";

export default function TagPage() {
  const { name } = useParams<{ name: string }>();
  const decoded = decodeURIComponent(name);
  return (
    <TaskListView
      title={`#${decoded}`}
      subtitle="All tasks with this tag."
      filter={{ tagName: decoded }}
    />
  );
}
