"use client";

import { useDraggable } from "@dnd-kit/core";
import { useState } from "react";
import { CalendarEventChip } from "./calendar-event-chip";
import { EventEditDialog } from "./event-edit-dialog";
import type { CalendarEvent } from "@/lib/db.types";
import type { LanguageCode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Round F v4: wraps the read-only CalendarEventChip in a dnd-kit useDraggable
 * so the user can drag a Google event to a different day on the month grid.
 *
 * Round F v4.6: the compact variant (calendar month grid) now renders as a
 * task-look-alike div — same chip shape, same colored bg, same grab cursor
 * as DraggableTask — instead of the muted button used for inline event
 * chips elsewhere. This makes Google events drag like first-class tasks
 * on the calendar page (single visual category, single drag mechanism).
 *
 * Drag id format: event::<eventId>::<fromKey-yyyy-MM-dd>
 *
 * The calendar page's onDragEnd handler splits on "::" and dispatches based
 * on the first segment ("event" -> PATCH gcal event, otherwise -> update task).
 *
 * Click-vs-drag: PointerSensor in calendar/page.tsx is configured with
 * `activationConstraint: { distance: 6 }` so plain clicks still flow through
 * to open the EventEditDialog.
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
  const [editing, setEditing] = useState(false);

  // Compact (calendar month grid) — render as a task-style chip so Google
  // events visually + behaviorally match DraggableTask. Different bg color
  // (sky-tinted) so users can still distinguish at a glance, but same
  // chip shape, same grab cursor, same click-to-edit behavior.
  if (size === "compact") {
    const title = event.title?.trim() || "Untitled event";
    const tooltip = `${title}${event.location ? " - " + event.location : ""} (Google Calendar)`;
    return (
      <>
        <div
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          title={tooltip}
          style={{ touchAction: "none" }}
          className={cn(
            "px-1.5 py-1 rounded text-[11px] truncate select-none",
            "cursor-grab active:cursor-grabbing",
            // Tailwind sky tones — saturated like priorityBg but distinct
            // so events read as their own color category vs. priority tasks.
            "bg-sky-500/40 hover:bg-sky-500/55 text-fg",
            isDragging && "opacity-30"
          )}
        >
          {title}
        </div>
        {editing && (
          <EventEditDialog
            event={event}
            lang={lang}
            onClose={() => setEditing(false)}
          />
        )}
      </>
    );
  }

  // Default / timeline — keep the existing inner-chip rendering. These
  // surfaces (e.g. day timeline) want the iconified, time-prefixed chip.
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
    >
      <CalendarEventChip event={event} lang={lang} size={size} />
    </div>
  );
}
