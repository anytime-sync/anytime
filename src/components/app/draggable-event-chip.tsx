"use client";

import { useDraggable } from "@dnd-kit/core";
import { CalendarEventChip } from "./calendar-event-chip";
import type { CalendarEvent } from "@/lib/db.types";
import type { LanguageCode } from "@/lib/i18n";

/**
 * Round F v4: wraps the read-only CalendarEventChip in a dnd-kit useDraggable
 * so the user can drag a Google event to a different day on the month grid.
 *
 * Drag id format:  event::<eventId>::<fromKey-yyyy-MM-dd>
 *
 * The calendar page's onDragEnd handler splits on "::" and dispatches based
 * on the first segment ("event" → PATCH gcal event, otherwise → update task).
 *
 * Click-vs-drag: PointerSensor in calendar/page.tsx is configured with
 * `activationConstraint: { distance: 6 }` so plain clicks still flow through
 * to the chip's onClick (which opens the edit dialog).
 */
export function DraggableEventChip({
  event,
  lang,
  size = "default",
  fromKey,
}: {
  event: CalendarEvent;
  lang: LanguageCode | string;
  size?: "default" | "compact" | "timeline";
  fromKey?: string;
}) {
  const dragId = `event::${event.id}::${fromKey ?? ""}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        opacity: isDragging ? 0.4 : undefined,
        cursor: "grab",
        touchAction: "none",
      }}
      className={size === "compact" ? "w-full" : undefined}
    >
      <CalendarEventChip event={event} lang={lang} size={size} />
    </div>
  );
}
