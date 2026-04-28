"use client";

import { useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReorderTasks, type TaskWithTags } from "@/hooks/use-tasks";
import { TaskItem } from "./task-item";
import { cn } from "@/lib/utils";

const SPACING = 1024;

export function SortableTaskList({
  tasks,
  onManualReorder,
}: {
  tasks: TaskWithTags[];
  /** Fired after a successful drag-to-reorder. Used by date-sorted views
   *  to flip themselves into "manual" mode so the user's hand-arranged
   *  order sticks instead of snapping back to date order. */
  onManualReorder?: () => void;
}) {
  const reorder = useReorderTasks();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = tasks.findIndex((t) => t.id === String(active.id));
    const newIndex = tasks.findIndex((t) => t.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(tasks, oldIndex, newIndex);
    // Compute new positions for the visible list, then send updates for
    // every visible row. We rewrite all positions (not just changed rows)
    // because in date-sorted views the underlying positions might be
    // unrelated to the visible order — we want the new manual order to
    // be a clean, deterministic sequence going forward.
    const changes: Array<{ id: string; position: number }> = reordered.map(
      (t, i) => ({ id: t.id, position: (i + 1) * SPACING })
    );
    if (changes.length > 0) {
      reorder.mutate(changes);
      onManualReorder?.();
    }
  }

  if (tasks.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {tasks.map((t) => (
            <SortableRow key={t.id} task={t} dimmed={activeId === t.id} />
          ))}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 150 }}>
        {activeTask ? (
          <div className="rounded-md ring-2 ring-accent shadow-2xl bg-bg">
            <TaskItem task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableRow({ task, dimmed }: { task: TaskWithTags; dimmed: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-md cursor-grab active:cursor-grabbing",
        (dimmed || isDragging) && "opacity-30"
      )}
    >
      <TaskItem task={task} />
    </div>
  );
}
