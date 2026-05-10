"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReorderTasks } from "@/hooks/use-tasks";
import { TaskItem } from "./task-item";
import { EventTaskRow } from "./event-task-row";
import type { ViewItem } from "@/hooks/use-view-items";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/lib/i18n";

const SPACING = 1024;

/**
 * Round F v4.3: drag-to-reorder list that renders a mixed stream of
 * native tasks AND Google Calendar events. Only tasks are draggable;
 * events are rendered as static rows in their natural time-sorted slot.
 *
 * When the user drags a task to a new position, ONLY task positions
 * are recomputed. Events keep their natural slot in the next render
 * because they're sorted by start_at, not by `position`.
 */
export function SortableMixedList({
  items,
  lang,
  onManualReorder,
}: {
  items: ViewItem[];
  lang: LanguageCode | string;
  onManualReorder?: () => void;
}) {
  const reorder = useReorderTasks();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  // Only tasks participate in the sortable list. Events are skipped over
  // when reordering so dragging never tries to "move" a calendar event.
  const taskItems = items.filter((it) => it.kind === "task");
  const taskIds = taskItems.map((it) => it.id);
  const activeItem = activeId ? items.find((it) => it.id === activeId) ?? null : null;

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = taskItems.findIndex((it) => it.id === String(active.id));
    const newIndex = taskItems.findIndex((it) => it.id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(taskItems, oldIndex, newIndex);
    const changes: Array<{ id: string; position: number }> = reordered.map(
      (it, i) => ({ id: it.id, position: (i + 1) * SPACING })
    );
    if (changes.length > 0) {
      reorder.mutate(changes);
      onManualReorder?.();
    }
  }

  if (items.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {items.map((it) =>
            it.kind === "task" ? (
              <SortableTaskRow
                key={it.id}
                taskId={it.id}
                task={it.task}
                dimmed={activeId === it.id}
              />
            ) : (
              <div key={it.id} className="rounded-md">
                <EventTaskRow event={it.event} lang={lang} />
              </div>
            )
          )}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 150 }}>
        {activeItem && activeItem.kind === "task" ? (
          <div className="rounded-md ring-2 ring-accent shadow-2xl bg-bg">
            <TaskItem task={activeItem.task} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function SortableTaskRow({
  taskId,
  task,
  dimmed,
}: {
  taskId: string;
  task: import("@/hooks/use-tasks").TaskWithTags;
  dimmed: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: taskId });
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
