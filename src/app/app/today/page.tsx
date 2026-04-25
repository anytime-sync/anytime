"use client";
import { TaskListView } from "@/components/app/task-list-view";
import { format } from "date-fns";

export default function TodayPage() {
  return (
    <TaskListView
      title="Today"
      subtitle={format(new Date(), "EEEE, MMMM d")}
      filter={{ view: "today" }}
    />
  );
}
