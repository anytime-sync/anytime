"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, formatDistanceToNow, startOfDay } from "date-fns";
import { useLanguage } from "@/lib/use-language";
import { t, getLanguage, type LanguageCode } from "@/lib/i18n";
import {
  useGroupActivity,
  type ActivityRow,
} from "@/hooks/use-group-activity";
import { useUIStore } from "@/store/ui";

type GroupSummary = { id: string; name: string };

/**
 * /app/groups/[id]/activity — group-scoped activity stream.
 *
 * Lists the latest 100 events newest-first, grouped by calendar day.
 * Polls every 60s via useGroupActivity. Clicking a row with a task_id
 * opens the task detail panel via the global UI store; for deleted
 * tasks the link is just informational.
 */
export default function GroupActivityPage() {
  const params = useParams();
  const groupId = String(params?.id ?? "");
  const lang = useLanguage();
  const dfLocale = getLanguage(lang).dateFnsLocale;
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId);

  const [group, setGroup] = useState<GroupSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/share-groups");
        if (!r.ok) return;
        const j = (await r.json()) as {
          rows?: Array<{ group: GroupSummary | null }>;
        };
        const found = (j.rows ?? [])
          .map((row) => row.group)
          .find((g) => g && g.id === groupId);
        if (!cancelled && found) setGroup(found);
      } catch {
        /* noop */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const { data: rows = [], isLoading } = useGroupActivity(groupId);

  const grouped = useMemo(() => groupByDay(rows), [rows]);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <header className="space-y-1">
        <Link
          href="/app/groups"
          className="text-xs text-muted-fg hover:text-fg"
        >
          ← {t(lang, "view.groups.heading")}
        </Link>
        <h1 className="font-display text-3xl">
          {group?.name
            ? `${group.name} · ${t(lang, "activity.title")}`
            : t(lang, "activity.title")}
        </h1>
        <p className="text-sm text-muted-fg">
          {t(lang, "activity.subtitle")}
        </p>
      </header>

      {isLoading && (
        <p className="text-muted-fg italic">
          {t(lang, "activity.loading")}
        </p>
      )}

      {!isLoading && rows.length === 0 && (
        <p className="text-muted-fg italic">{t(lang, "activity.empty")}</p>
      )}

      <div className="space-y-6">
        {grouped.map(({ dayKey, dayDate, items }) => (
          <section key={dayKey} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-fg">
              {format(dayDate, "PPP", { locale: dfLocale })}
            </h2>
            <ul className="space-y-2">
              {items.map((row) => (
                <ActivityItem
                  key={row.id}
                  row={row}
                  lang={lang}
                  dfLocale={dfLocale}
                  onOpenTask={(taskId) => setSelectedTaskId(taskId)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function ActivityItem({
  row,
  lang,
  dfLocale,
  onOpenTask,
}: {
  row: ActivityRow;
  lang: LanguageCode;
  dfLocale: ReturnType<typeof getLanguage>["dateFnsLocale"];
  onOpenTask: (taskId: string) => void;
}) {
  const display =
    row.actor?.full_name?.trim() ||
    row.actor?.email ||
    t(lang, "view.groups.unknownMember");
  const initial =
    (display.match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase();

  const created = new Date(row.created_at);
  const kindLabel = labelForKind(lang, row.kind);
  const taskTitle =
    (row.payload?.title as string | undefined) ?? "";
  const preview = (row.payload?.preview as string | undefined) ?? "";
  const isCommented = row.kind === "task_commented";
  const isDeleted = row.kind === "task_deleted";

  const titleNode = taskTitle ? (
    isDeleted || !row.task_id ? (
      <span className="font-medium">{taskTitle}</span>
    ) : (
      <button
        onClick={() => row.task_id && onOpenTask(row.task_id)}
        className="font-medium hover:underline underline-offset-2"
      >
        {taskTitle}
      </button>
    )
  ) : null;

  return (
    <li className="flex gap-3 text-sm">
      {row.actor?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.actor.avatar_url}
          alt={display}
          className="size-8 rounded-full object-cover shrink-0"
        />
      ) : (
        <span className="size-8 rounded-full bg-accent/20 text-accent text-[12px] font-medium grid place-items-center shrink-0">
          {initial}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-medium">{display}</span>
          <span className="text-muted-fg">{kindLabel}</span>
          {titleNode}
          <span
            className="text-[10px] text-muted-fg ml-auto"
            title={created.toISOString()}
          >
            {formatDistanceToNow(created, {
              addSuffix: true,
              locale: dfLocale,
            })}
          </span>
        </div>
        {isCommented && preview && (
          <p className="text-xs text-muted-fg mt-0.5 line-clamp-2 whitespace-pre-wrap break-words">
            {preview}
          </p>
        )}
      </div>
    </li>
  );
}

function labelForKind(lang: LanguageCode, kind: string): string {
  switch (kind) {
    case "task_created":
      return t(lang, "activity.kind.taskCreated");
    case "task_completed":
      return t(lang, "activity.kind.taskCompleted");
    case "task_reopened":
      return t(lang, "activity.kind.taskReopened");
    case "task_assigned":
      return t(lang, "activity.kind.taskAssigned");
    case "task_shared":
      return t(lang, "activity.kind.taskShared");
    case "task_deleted":
      return t(lang, "activity.kind.taskDeleted");
    case "task_commented":
      return t(lang, "activity.kind.taskCommented");
    default:
      return kind;
  }
}

function groupByDay(rows: ActivityRow[]): Array<{
  dayKey: string;
  dayDate: Date;
  items: ActivityRow[];
}> {
  const buckets = new Map<string, { dayDate: Date; items: ActivityRow[] }>();
  for (const r of rows) {
    const d = startOfDay(new Date(r.created_at));
    const key = d.toISOString();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { dayDate: d, items: [] };
      buckets.set(key, bucket);
    }
    bucket.items.push(r);
  }
  // rows arrive newest-first already; preserve insertion order, sorted
  // by day-key descending.
  return Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([dayKey, v]) => ({ dayKey, dayDate: v.dayDate, items: v.items }));
}
