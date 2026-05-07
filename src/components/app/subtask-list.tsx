"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  useSubtasks, useCreateTask, useToggleTask, useUpdateTask,
  useDeleteTask, useReorderTasks,
} from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";

export function SubtaskList({
  parentId,
  parentProjectId,
}: {
  parentId: string;
  parentProjectId: string | null;
}) {
  const lang = useLanguage();
  const { data: subtasks = [], isLoading } = useSubtasks(parentId);
  const create = useCreateTask();
  const reorder = useReorderTasks();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = subtasks.findIndex((s) => s.id === active.id);
    const newIndex = subtasks.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(subtasks, oldIndex, newIndex);
    reorder.mutate(next.map((t, i) => ({ id: t.id, position: i })));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    await create.mutateAsync({
      title: draft.trim(),
      parent_id: parentId,
      project_id: parentProjectId ?? null,
    });
    setDraft("");
  }

  return (
    <div className="space-y-1">
      {isLoading && <p className="text-xs text-muted-fg">{t(lang, "subtasks.loading")}</p>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {subtasks.map((s) => (
            <SortableSubtask key={s.id} subtask={s} />
          ))}
        </SortableContext>
      </DndContext>

      {adding ? (
        <form onSubmit={add} className="flex items-center gap-2 px-1 py-1">
          <span className="size-4 rounded-full border-2 border-muted-fg shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-fg"
            placeholder={t(lang, "subtasks.newPlaceholder")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (!draft.trim()) setAdding(false);
            }}
          />
        </form>
      ) : (
        <button
          type="button"
          className="flex items-center gap-2 px-1 py-1 text-sm text-muted-fg hover:text-fg"
          onClick={() => setAdding(true)}
        >
          <Plus className="size-3.5" />
          Add subtask
        </button>
      )}
    </div>
  );
}

function SortableSubtask({ subtask }: { subtask: any }) {
  const lang = useLanguage();
  const toggle = useToggleTask();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: subtask.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group flex items-center gap-2 px-1 py-1 rounded-md hover:bg-muted/60 cursor-grab active:cursor-grabbing"
    >
      <button
        aria-label="toggle"
        className={cn(
          "size-4 rounded-full border-2 grid place-items-center shrink-0",
          subtask.is_completed ? "bg-success border-success text-white" : "border-muted-fg"
        )}
        onClick={(e) => {
          e.stopPropagation();
          toggle(subtask);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {subtask.is_completed && (
          <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-6" />
          </svg>
        )}
      </button>
      <input
        className={cn(
          "flex-1 bg-transparent outline-none text-sm",
          subtask.is_completed && "line-through text-muted-fg"
        )}
        defaultValue={subtask.title}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== subtask.title) update.mutate({ id: subtask.id, title: v });
        }}
      />
      <button
        className="opacity-0 group-hover:opacity-100 text-muted-fg hover:text-danger"
        onClick={(e) => {
          e.stopPropagation();
          del.mutate(subtask.id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={t(lang, "subtasks.deleteAria")}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
