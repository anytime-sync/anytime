"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, Loader2, X, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useScanTasksAI, type ScannedTask } from "@/hooks/use-ai";
import { useCreateTask } from "@/hooks/use-tasks";
import { useCreateProject, useProjects } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { t as tr } from "@/lib/i18n";

/**
 * Scan-tasks sheet.
 *
 * Flow:
 *   1. User taps "Scan tasks" inside QuickAdd → this opens.
 *   2. They take a photo (mobile camera) or upload an image.
 *   3. We POST it to /api/ai/scan-tasks. Claude vision returns an array
 *      of {title, due_at, priority, tagNames, ...} objects.
 *   4. We render the array as an editable preview list — each row has
 *      a checkbox, the title, the parsed due date, and a priority chip.
 *   5. User unchecks anything they don't want, edits any title inline,
 *      then clicks "Add N tasks". We bulk-create through the existing
 *      useCreateTask mutation (optimistic insert per row).
 */
export function ScanTasksSheet({
  open,
  onClose,
  onCreated,
  initialFile,
}: {
  open: boolean;
  onClose: () => void;
  /** Fires after the user confirms the bulk create — lets QuickAdd close itself. */
  onCreated?: (count: number) => void;
  initialFile?: File | null;
}) {
  const lang = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const scan = useScanTasksAI();
  const createTask = useCreateTask();
  const createProject = useCreateProject();
  const { data: projects = [] } = useProjects();

  useEffect(() => {
    if (!open) {
      // Reset everything when the sheet closes so opening it again
      // starts from a clean slate.
      setPreviewUrl(null);
      setTasks([]);
      setSubmitting(false);
    }
  }, [open]);

  // Revoke any object URL we created so we don't leak across opens.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);
  useEffect(() => { if (open && initialFile) void handleFile(initialFile); }, [open, initialFile]);

  if (!open) return null;

  async function handleFile(file: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(tr(lang, "scan.errNotImage"));
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error(tr(lang, "scan.errTooLarge"));
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setTasks([]);
    try {
      const result = await scan.mutateAsync(file);
      if (!result) {
        toast.error(tr(lang, "scan.errAiOff"));
        return;
      }
      if (!result.tasks.length) {
        toast.message(tr(lang, "scan.errNoTasks"));
        return;
      }
      setTasks(
        result.tasks.map((t, i) => ({
          ...t,
          _id: `${Date.now()}-${i}`,
          _checked: true,
        }))
      );
    } catch (e: any) {
      toast.error(e?.message ?? tr(lang, "scan.errFailed"));
    }
  }

  async function handleConfirm() {
    const picked = tasks.filter((t) => t._checked && t.title.trim());
    if (!picked.length) {
      onClose();
      return;
    }
    setSubmitting(true);
    let created = 0;
    for (const t of picked) {
      try {
        // Resolve the project name to an id, creating a new project if needed.
        let projectId: string | null = null;
        if (t.projectName) {
          const found = projects.find(
            (p: any) => p.name.toLowerCase() === t.projectName!.toLowerCase()
          );
          projectId = found
            ? found.id
            : (await createProject.mutateAsync({ name: t.projectName })).id;
        }
        await createTask.mutateAsync({
          title: t.title.trim(),
          start_at: t.start_at ?? null,
          due_at: t.due_at ?? null,
          is_all_day: t.is_all_day ?? false,
          priority: t.priority ?? 0,
          tagNames: t.tagNames ?? [],
          project_id: projectId,
          rrule: t.rrule ?? null,
          reminder_at: t.reminder_at ?? null,
        } as any);
        created += 1;
      } catch {
        // Continue on per-row error so a single bad row doesn't lose the others.
      }
    }
    setSubmitting(false);
    if (created > 0) {
      toast.success(
        created === 1 ? tr(lang, "scan.toastAddedOne") : tr(lang, "scan.toastAddedMany").replace("{n}", String(created))
      );
      onCreated?.(created);
    }
    onClose();
  }

  const checkedCount = tasks.filter((t) => t._checked).length;

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center px-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="card surface-strong w-full max-w-xl p-4 md:p-5 space-y-3 md:space-y-4 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="editorial-number text-[10px] uppercase tracking-[0.18em]">
              {tr(lang, "scan.kicker")}
            </p>
            <h2 className="font-display text-lg md:text-xl">
              {tr(lang, "scan.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost h-8 w-8 inline-flex items-center justify-center rounded-full"
            aria-label={tr(lang, "common.close")}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Source picker — only visible until we have an image. */}
        {!previewUrl && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="btn-ghost border border-border rounded-lg py-6 flex flex-col items-center gap-2 hover:bg-accent/10"
            >
              <Camera className="size-6 text-accent" />
              <span className="text-sm">{tr(lang, "scan.takePhoto")}</span>
              <span className="text-[10px] text-muted-fg">
                {tr(lang, "scan.takePhotoHint")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-ghost border border-border rounded-lg py-6 flex flex-col items-center gap-2 hover:bg-accent/10"
            >
              <ImageIcon className="size-6 text-accent" />
              <span className="text-sm">{tr(lang, "scan.uploadImage")}</span>
              <span className="text-[10px] text-muted-fg">
                {tr(lang, "scan.uploadImageHint")}
              </span>
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {/* Image preview + scan progress */}
        {previewUrl && (
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              <img
                src={previewUrl}
                alt="Scan preview"
                className="w-24 h-24 object-cover rounded-md border border-border"
              />
              <button
                onClick={() => {
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                  setTasks([]);
                }}
                className="absolute -top-1 -right-1 size-5 rounded-full bg-bg/90 border border-border inline-flex items-center justify-center"
                aria-label={tr(lang, "scan.removeImage")}
              >
                <X className="size-3" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              {scan.isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-fg">
                  <Loader2 className="size-4 animate-spin" />
                  {tr(lang, "scan.reading")}
                </div>
              ) : tasks.length > 0 ? (
                <p className="text-sm text-muted-fg">
                  {(tasks.length === 1 ? tr(lang, "scan.foundOne") : tr(lang, "scan.foundMany")).replace("{n}", String(tasks.length))}
                </p>
              ) : (
                <p className="text-sm text-muted-fg italic">
                  {tr(lang, "scan.unreadable")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Editable preview list */}
        {tasks.length > 0 && (
          <ul className="space-y-2 overflow-y-auto -mx-1 px-1 flex-1 min-h-0">
            {tasks.map((t, i) => (
              <li
                key={t._id}
                className={cn(
                  "border border-border rounded-md p-2.5 space-y-1.5",
                  !t._checked && "opacity-50"
                )}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={t._checked}
                    onChange={(e) =>
                      setTasks((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, _checked: e.target.checked } : x
                        )
                      )
                    }
                    className="mt-1 accent-accent size-4 shrink-0 cursor-pointer"
                  />
                  <input
                    value={t.title}
                    onChange={(e) =>
                      setTasks((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, title: e.target.value } : x
                        )
                      )
                    }
                    className="flex-1 bg-transparent outline-none text-sm font-medium min-w-0"
                  />
                  <button
                    onClick={() =>
                      setTasks((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="btn-ghost h-6 w-6 inline-flex items-center justify-center rounded text-muted-fg hover:text-danger shrink-0"
                    aria-label={tr(lang, "common.remove")}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-fg pl-6">
                  {t.due_at && (
                    <span className="inline-flex items-center gap-1 border border-border rounded px-1.5 py-0.5">
                      {formatWhen(t.due_at, t.is_all_day)}
                    </span>
                  )}
                  {t.priority > 0 && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 border",
                        t.priority === 5 && "border-p-high text-p-high bg-p-high/10",
                        t.priority === 3 && "border-p-med text-p-med bg-p-med/10",
                        t.priority === 1 && "border-p-low text-p-low bg-p-low/10"
                      )}
                    >
                      {priorityWord(t.priority)}
                    </span>
                  )}
                  {(t.tagNames ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 border border-border rounded px-1.5 py-0.5"
                    >
                      #{tag}
                    </span>
                  ))}
                  {t.projectName && (
                    <span className="inline-flex items-center gap-1 border border-border rounded px-1.5 py-0.5">
                      ~{t.projectName}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onClose}
            className="btn-ghost h-9 px-3 text-sm"
            disabled={submitting}
          >
            {tr(lang, "scan.cancel")}
          </button>
          {tasks.length > 0 && (
            <button
              onClick={handleConfirm}
              disabled={submitting || checkedCount === 0}
              className={cn(
                "ml-auto h-9 px-4 text-sm rounded-md inline-flex items-center gap-2",
                checkedCount > 0 && !submitting
                  ? "bg-fg text-bg hover:opacity-90"
                  : "bg-muted text-muted-fg cursor-not-allowed"
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {tr(lang, "scan.adding")}
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  {(checkedCount === 1 ? tr(lang, "scan.addOne") : tr(lang, "scan.addMany")).replace("{n}", String(checkedCount))}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type EditableTask = ScannedTask & {
  _id: string;
  _checked: boolean;
};

/* ---------- formatters ---------- */

function priorityWord(p: number): string {
  if (p === 5) return "Urgent";
  if (p === 3) return "Important";
  if (p === 1) return "Low";
  return "";
}

function formatWhen(iso: string, allDay: boolean | undefined): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    const datePart = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: sameYear ? undefined : "numeric",
    });
    if (allDay) return datePart;
    const timePart = d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${datePart} · ${timePart}`;
  } catch {
    return iso;
  }
}
