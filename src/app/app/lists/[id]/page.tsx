"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { TaskListView } from "@/components/app/task-list-view";
import { KanbanView } from "@/components/app/kanban-view";
import { useProjects, useUpdateProject } from "@/hooks/use-projects";
import { LayoutList, Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ListPage() {
  const { id } = useParams<{ id: string }>();
  const { data: projects = [] } = useProjects();
  const project = projects.find((p) => p.id === id);
  const update = useUpdateProject();

  // Local override = current session view; defaults to project.view_mode.
  const [override, setOverride] = useState<"list" | "kanban" | null>(null);
  const mode = override ?? (project?.view_mode === "kanban" ? "kanban" : "list");

  function setMode(m: "list" | "kanban") {
    setOverride(m);
    if (project && project.view_mode !== m) {
      update.mutate({ id: project.id, view_mode: m });
    }
  }

  const Toggle = (
    <div className="inline-flex items-center rounded-md border border-border p-0.5">
      <button
        className={cn(
          "h-7 px-2 text-xs flex items-center gap-1 rounded",
          mode === "list" ? "bg-muted text-fg" : "text-muted-fg hover:text-fg"
        )}
        onClick={() => setMode("list")}
        aria-pressed={mode === "list"}
      >
        <LayoutList className="size-3.5" /> List
      </button>
      <button
        className={cn(
          "h-7 px-2 text-xs flex items-center gap-1 rounded",
          mode === "kanban" ? "bg-muted text-fg" : "text-muted-fg hover:text-fg"
        )}
        onClick={() => setMode("kanban")}
        aria-pressed={mode === "kanban"}
      >
        <Columns3 className="size-3.5" /> Kanban
      </button>
    </div>
  );

  if (mode === "kanban") {
    return (
      <div className="h-full flex flex-col">
        <div className="px-6 pt-4 flex items-center justify-end">{Toggle}</div>
        <div className="flex-1 min-h-0">
          <KanbanView
            title={project?.name ?? "List"}
            subtitle="Drag cards between columns to change priority."
            filter={{ projectId: id }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-4 flex items-center justify-end">{Toggle}</div>
      <div className="flex-1 min-h-0">
        <TaskListView
          title={project?.name ?? "List"}
          subtitle={project ? `Color: ${project.color}` : undefined}
          filter={{ projectId: id }}
          defaults={{ project_id: id }}
        />
      </div>
    </div>
  );
}
