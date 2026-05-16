"use client";
import { TaskListView } from "@/components/app/task-list-view";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";

export default function InboxPage() {
  const lang = useLanguage();
  return (
    <TaskListView
      title={t(lang, "sidebar.inbox")}
      subtitle={t(lang, "view.inbox.subtitle")}
      filter={{ view: "inbox" }}
      groupByDate
    />
  );
}
