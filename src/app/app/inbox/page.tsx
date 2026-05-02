"use client";
import { TaskListView } from "@/components/app/task-list-view";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/lib/use-language";

export default function InboxPage() {
  const lang = useLanguage();
  return (
    <TaskListView
      title={t(lang, "sidebar.inbox")}
      subtitle="Every active task, across every list."
      filter={{ view: "all" }}
      groupByDate
    />
  );
}
