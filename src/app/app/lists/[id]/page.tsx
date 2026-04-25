"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { TaskListView } from "@/components/app/task-list-view";
import { KanbanView } from "@/components/app/kanban-view";
import { MembersDialog } from "@/components/app/members-dialog";
import { useProjects, useUpdateProject } from "@/hooks/use-projects";
import { useProjectMembers } from "@/hooks/use-members";
import { LayoutList, Columns3, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ListPage() {
  const { id } = useParams<{ id: string }>();
  const { data: projects = [] } = useProjects();
  const project = projects.find((p) => p.id === id);
  const update = useUpdateProject();
  const { data: members = [] } = useProjectMembers(id);

  const [override, setOverride] = useState<"list" | "kanban" | null>(null);
  const mode = override ?? (project?.view_mode === "kanban" ? "kanban" : "list");
  const [showMembers, setShowMembers] = useState(false);

  function setMode(m: "list" | "kanban") {
    setOverride(m);
    if (project && project.view_mode !== m) {
      update.mutate({ id: project.id, view_mode: m });
    }
  }

  const Header = (
    <div className="px-6 pt-4 flex items-center justify-end gap-2">
      <button
        className="inline-flex items-center gap-1.5 h-8 px-2 rounded-md border border-border text-xs hover:bg-muted"
        onClick={() => setShowMembers(true)}
        aria-label="Share list"
      >
        <Users className="size-3.5" />
        Share
        {members.length > 1 && (
          <span className="ml-1 text-[10px] text-muted-fg">({members.length})</span>
        )}
      </button>
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
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {Header}
      <div className="flex-1 min-h-0">
        {mode === "kanban" ? (
          <KanbanView
            title={project?.name ?? "List"}
            subtitle="Drag cards between columns to change priority."
            filter={{ projectId: id }}
          />
        ) : (
          <TaskListView
            title={project?.name ?? "List"}
            subtitle={project ? `Color: ${project.color}` : undefined}
            filter={{ projectId: id }}
            defaults={{ project_id: id }}
          />
        )}
      </div>
      {showMembers && (
        <MembersDialog
          projectId={id}
          projectName={project?.name ?? "List"}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  );
}
