"use client";
import { TaskListView } from "@/components/app/task-list-view";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";

export default function Next90Page() {
  const lang = useLanguage();
  return (
    <TaskListView
      title={t(lang, "sidebar.next90")}
      subtitle={t(lang, "view.next90.subtitle")}
      filter={{ view: "next90" }}
      sortBy="due_at"
    />
  );
}
