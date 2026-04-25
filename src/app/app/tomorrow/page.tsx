"use client";
import { TaskListView } from "@/components/app/task-list-view";
import { addDays, format } from "date-fns";

export default function TomorrowPage() {
  return (
    <TaskListView
      title="Tomorrow"
      subtitle={format(addDays(new Date(), 1), "EEEE, MMMM d")}
      filter={{ view: "tomorrow" }}
    />
  );
}
