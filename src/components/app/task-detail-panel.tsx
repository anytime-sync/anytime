"use client";

import { useUIStore } from "@/store/ui";
import { useTask, useUpdateTask, useDeleteTask, useToggleTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { format } from "date-fns";
import { Bell, Flag, Trash2, X, Repeat, Paperclip } from "lucide-react";
import { useEffect, useState } from "react";
import { cn, priorityColorClass } from "@/lib/utils";
import { SubtaskList } from "./subtask-list";
import { AttachmentList } from "./attachment-list";
import { TagEditor } from "./tag-editor";
import { DateTimePicker } from "./date-time-picker";

const RECURRENCE_PRESETS: Array<{ value: string; label: string }> = [
  { value: "", label: "Doesn't repeat" },
  { value: "FREQ=DAILY", label: "Daily" },
  { value: "FREQ=DAILY;INTERVAL=2", label: "Every other day" },
  { value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", label: "Weekdays (MonâFri)" },
  { value: "FREQ=WEEKLY;BYDAY=SA,SU", label: "Weekends" },
  { value: "FREQ=WEEKLY", label: "Weekly" },
  { value: "FREQ=WEEKLY;INTERVAL=2", label: "Every other week" },
  { value: "FREQ=MONTHLY", label: "Monthly" },
  { value: "FREQ=MONTHLY;INTERVAL=3", label: "Every 3 months" },
  { value: "FREQ=YEARLY", label: "Yearly" },
];

function localInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function TaskDetailPanel() {
  const id = useUIStore((s) => s.selectedTaskId);
  const setId = useUIStore((s) => s.setSelectedTaskId);
  const { data: task } = useTask(id);
  const { data: projects = [] } = useProjects();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const toggle = useToggleTask();

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes ?? "");
    }
  }, [task]);

  if (!id || !task) return null;

  const recurrenceMatch = RECURRENCE_PRESETS.find((p) => p.value === (task.rrule ?? ""));
  const recurrenceValue = recurrenceMatch ? recurrenceMatch.value : (task.rrule ?? "");

  return (
    <aside
      className={cn(
        // On mobile (<md), the panel is a full-screen overlay so the
        // close button is reachable. The previous fixed 380px layout
        // pushed the X button off-screen on narrow viewports because
        // the parent <main> clips with overflow-hidden.
        "fixed inset-0 z-40 w-full",
        "md:relative md:inset-auto md:z-auto md:w-[380px]",
        "shrink-0 h-full border-l-0 md:border-l border-border",
        "surface-strong animate-slide-in-right flex flex-col"
      )}
    >
      <div className="flex items-center justify-between px-3 h-12 border-b border-border">
        <button
          aria-label={task.is_completed ? "Mark incomplete" : "Mark complete"}
          onClick={() => toggle(task)}
          className={cn(
            "size-5 rounded-full border-2 grid place-items-center",
            task.is_completed
              ? "bg-success border-success text-white"
              : task.priority >= 5
              ? "border-p-high"
              : task.priority >= 3
              ? "border-p-med"
              : task.priority >= 1
              ? "border-p-low"
              : "border-muted-fg"
          )}
        >
          {task.is_completed && (
            <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 6l3 3 5-6" />
            </svg>
          )}
        </button>
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost size-9 p-0 grid place-items-center text-danger"
            onClick={async () => {
              await del.mutateAsync(task.id);
              setId(null);
            }}
            title="Delete"
          >
            <Trash2 className="size-4" />
          </button>
          {/* Done button — labeled on mobile so it's an obvious tap
              target; compact X on desktop. */}
          <button
            className="btn-ghost h-9 px-2 md:px-0 md:size-9 grid place-items-center md:p-0 gap-1 text-sm"
            onClick={() => setId(null)}
            title="Close"
            aria-label="Close task editor"
          >
            <X className="size-4" />
            <span className="md:hidden">Done</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <input
          className={cn(
            "w-full bg-transparent outline-none text-lg font-semibold",
            task.is_completed && "line-through text-muted-fg"
          )}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() && title !== task.title) {
              update.mutate({ id: task.id, title: title.trim() });
            }
          }}
        />

        {/* Start + Due pair — Starts is optional. When set, the task
            is treated as a time block and renders that way on the
            timeline view. Empty Starts = "due-only" task. */}
        <div className="grid grid-cols-1 gap-3">
          <Field label="Starts">
            <DateTimePicker
              value={task.start_at}
              placeholder="Pick a start time"
              onChange={(iso) => {
                // If the new start lands AFTER the current due, slide
                // due forward by the same amount so the task keeps its
                // original span (start <= due always holds).
                const patch: { id: string; start_at: string | null; due_at?: string } = {
                  id: task.id,
                  start_at: iso,
                };
                if (iso && task.start_at && task.due_at) {
                  const newStart = new Date(iso).getTime();
                  const oldStart = new Date(task.start_at).getTime();
                  const oldDue = new Date(task.due_at).getTime();
                  if (newStart > oldDue) {
                    const delta = oldDue - oldStart;
                    patch.due_at = new Date(newStart + delta).toISOString();
                  }
                }
                update.mutate(patch);
              }}
            />
          </Field>
          <Field label={task.start_at ? "Ends" : "Due"}>
            <DateTimePicker
              value={task.due_at}
              placeholder="Pick a due time"
              onChange={(iso) => {
                // Mirror image: if the new due lands BEFORE the current
                // start, slide start back by the same delta so the task
                // keeps its original span.
                const patch: { id: string; due_at: string | null; is_all_day: boolean; start_at?: string } = {
                  id: task.id,
                  due_at: iso,
                  is_all_day: false,
                };
                if (iso && task.start_at && task.due_at) {
                  const newDue = new Date(iso).getTime();
                  const oldStart = new Date(task.start_at).getTime();
                  const oldDue = new Date(task.due_at).getTime();
                  if (newDue < oldStart) {
                    const delta = oldDue - oldStart;
                    patch.start_at = new Date(newDue - delta).toISOString();
                  }
                }
                update.mutate(patch);
              }}
            />
          </Field>
        </div>

        <Field label="Repeat">
          <div className="flex items-center gap-2">
            <Repeat className="size-4 text-muted-fg" />
            <select
              className="input flex-1"
              value={recurrenceValue}
              onChange={(e) => {
                const v = e.target.value || null;
                update.mutate({ id: task.id, rrule: v });
              }}
            >
              {RECURRENCE_PRESETS.map((p) => (
                <option key={p.value || "none"} value={p.value}>
                  {p.label}
                </option>
              ))}
              {!recurrenceMatch && task.rrule && (
                <option value={task.rrule}>Custom: {task.rrule}</option>
              )}
            </select>
          </div>
          {task.rrule && !task.due_at && (
            <p className="text-[11px] text-muted-fg mt-1">
              Set a due date — recurrence creates the next occurrence when you complete the task.
            </p>
          )}
        </Field>

        <Field label="Reminder">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-muted-fg" />
            <input
              type="datetime-local"
              className="input flex-1"
              value={localInputValue(task.reminder_at)}
              onChange={(e) => {
                const v = e.target.value;
                update.mutate({
                  id: task.id,
                  reminder_at: v ? new Date(v).toISOString() : null,
                });
              }}
            />
          </div>
          <p className="text-[11px] text-muted-fg mt-1">
            Browser notification fires at this time while the app is open. Allow notifications when prompted.
          </p>
        </Field>

        <Field label="Priority">
          <div className="flex gap-1">
            {[0, 1, 3, 5].map((p) => (
              <button
                key={p}
                onClick={() => update.mutate({ id: task.id, priority: p as any })}
                className={cn(
                  "btn-outline px-2 h-8 text-xs",
                  task.priority === p && "bg-muted"
                )}
              >
                <Flag className={cn("size-3 mr-1", priorityColorClass(p))} />
                {p === 5 ? "High" : p === 3 ? "Medium" : p === 1 ? "Low" : "None"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="List">
          <select
            className="input"
            value={task.project_id ?? ""}
            onChange={(e) =>
              update.mutate({
                id: task.id,
                project_id: e.target.value || null,
              })
            }
          >
            <option value="">Inbox (no list)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Share with group">
          <div>
            <ShareGroupPicker
              value={(task as any).share_group_id ?? null}
              onChange={(v) =>
                update.mutate({ id: task.id, share_group_id: v } as any)
              }
            />
            <ManageGroupsLink />
          </div>
        </Field>

        <Field label="Tags">
          <TagEditor taskId={task.id} currentTags={task.tags} />
        </Field>

        <Field label="Subtasks">
          <SubtaskList parentId={task.id} parentProjectId={task.project_id} />
        </Field>

        <Field label="Attachments" icon={<Paperclip className="size-3.5 text-muted-fg" />}>
          <AttachmentList taskId={task.id} />
        </Field>

        <Field label="Notes">
          <textarea
            rows={6}
            className="input min-h-[120px] py-2"
            placeholder="Add notes…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== (task.notes ?? "")) {
                update.mutate({ id: task.id, notes });
              }
            }}
          />
        </Field>

        <div className="text-xs text-muted-fg">
          Created {format(new Date(task.created_at), "MMM d, yyyy")} · Updated{" "}
          {format(new Date(task.updated_at), "MMM d, yyyy")}
        </div>
      </div>
    </aside>
  );
}

function Field({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-fg flex items-center gap-1">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}


function ShareGroupPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/share-groups")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const list = ((j.rows ?? []) as Array<{ group: { id: string; name: string } }>)
          .map((r) => r.group)
          .filter((g) => g);
        setGroups(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <select
      className="input"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">Private &mdash; just me</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  );
}

// Re-export so the picker can render the helper link from the parent.
function ManageGroupsLink() {
  return (
    <a
      href="/app/groups"
      className="text-[11px] text-muted-fg hover:text-fg underline-offset-2 hover:underline mt-1 inline-block"
    >
      Manage groups &rarr;
    </a>
  );
}
