"use client";

import { useRef, useState } from "react";
import { File, Image as ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import {
  useTaskAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  formatBytes,
  type TaskAttachment,
} from "@/hooks/use-attachments";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB - matches the bucket limit.

export function AttachmentList({ taskId }: { taskId: string }) {
  const lang = useLanguage();
  const { data: attachments = [], isLoading } = useTaskAttachments(taskId);
  const upload = useUploadAttachment();
  const del = useDeleteAttachment();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        // upload mutation surfaces toast for user; this is a fast client-side guard
        // eslint-disable-next-line no-alert
        alert(`"${file.name}" is over 25 MB and was skipped.`);
        continue;
      }
      await upload.mutateAsync({ taskId, file });
    }
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "border border-dashed rounded-md px-3 py-3 text-xs text-muted-fg transition-colors",
          dragOver ? "border-accent bg-accent/5 text-fg" : "border-border"
        )}
      >
        <div className="flex items-center gap-2">
          <Upload className="size-3.5" />
          <span>{t(lang, "attachments.dropHere")}</span>
          <button
            type="button"
            className="text-accent hover:underline"
            onClick={() => inputRef.current?.click()}
          >
            choose files
          </button>
          <span>(max 25 MB each)</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            // reset so picking the same file twice still fires onChange
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
      </div>

      {isLoading && <p className="text-xs text-muted-fg">{t(lang, "attachments.loading")}</p>}

      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((a) => (
            <AttachmentRow key={a.id} a={a} onDelete={() => del.mutate(a)} />
          ))}
        </div>
      )}

      {upload.isPending && (
        <p className="text-xs text-muted-fg flex items-center gap-1">
          <Paperclip className="size-3" /> Uploading…
        </p>
      )}
    </div>
  );
}

function AttachmentRow({ a, onDelete }: { a: TaskAttachment; onDelete: () => void }) {
  const lang = useLanguage();
  const isImage = (a.mime_type ?? "").startsWith("image/");
  return (
    <div className="group flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/60">
      <div className="size-9 rounded bg-muted overflow-hidden grid place-items-center shrink-0">
        {isImage && a.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.url} alt="" className="w-full h-full object-cover" />
        ) : isImage ? (
          <ImageIcon className="size-4 text-muted-fg" />
        ) : (
          <File className="size-4 text-muted-fg" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        {a.url ? (
          <a
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm truncate block hover:underline"
            title={a.filename}
          >
            {a.filename}
          </a>
        ) : (
          <span className="text-sm truncate block">{a.filename}</span>
        )}
        <div className="text-[11px] text-muted-fg">{formatBytes(a.size_bytes)}</div>
      </div>
      <button
        className="opacity-0 group-hover:opacity-100 text-muted-fg hover:text-danger"
        onClick={onDelete}
        aria-label={t(lang, "attachments.deleteAria")}
        title={t(lang, "attachments.delete")}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
