"use client";

import { useParams } from "next/navigation";
import { TaskListView } from "@/components/app/task-list-view";
import { useProjects } from "@/hooks/use-projects";

export default function ListPage() {
  const { id } = useParams<{ id: string }>();
  const { data: projects = [] } = useProjects();
  const project = projects.find((p) => p.id === id);

  return (
    <TaskListView
      title={project?.name ?? "List"}
      subtitle={project ? `Color: ${project.color}` : undefined}
      filter={{ projectId: id }}
      defaults={{ project_id: id }}
    />
  );
}
