"use client";
import { TaskListView } from "@/components/app/task-list-view";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";

export default function CompletedPage() {
  const lang = useLanguage();
  return (
    <TaskListView
      title={t(lang, "sidebar.completed")}
      subtitle={t(lang, "view.completed.subtitle")}
      filter={{ view: "completed" }}
    />
  );
}
