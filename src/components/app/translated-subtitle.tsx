"use client";

import { useEffect, useState } from "react";
import { useTranslateTask } from "@/hooks/use-ai";

/**
 * If a task is in a share_group AND the viewer's preferred language
 * differs from the language the title appears to be in, render a small
 * inline AI translation under the title. Caches per (task_id, locale)
 * server-side so repeat renders are free after the first paint.
 *
 * Heuristic for "different language": we just check the first 16 chars
 * of the title for CJK vs Latin — good enough to skip pointless calls.
 */
export function TranslatedSubtitle({
  taskId,
  sourceTitle,
  shareGroupId,
}: {
  taskId: string;
  sourceTitle: string;
  shareGroupId: string | null | undefined;
}) {
  const translate = useTranslateTask();
  const [translation, setTranslation] = useState<string | null>(null);
  const targetLocale =
    typeof navigator !== "undefined"
      ? (navigator.language || "en").split("-")[0]
      : "en";

  useEffect(() => {
    if (!shareGroupId) return;
    if (!sourceTitle) return;
    // Cheap script-class compare — skip the call if both look like the same family.
    const hasCJK = /[㐀-鿿가-힯]/.test(sourceTitle);
    const viewerIsCJK = ["zh", "ja", "ko"].includes(targetLocale);
    if (hasCJK === viewerIsCJK) return;

    let cancelled = false;
    translate
      .mutateAsync({ task_id: taskId, source_title: sourceTitle, target_locale: targetLocale })
      .then((r) => {
        if (cancelled) return;
        if (r && r.translation && r.translation !== sourceTitle) {
          setTranslation(r.translation);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, sourceTitle, shareGroupId, targetLocale]);

  if (!translation) return null;
  return (
    <span className="block text-[11px] text-muted-fg italic mt-0.5 truncate">
      {translation}
    </span>
  );
}
