"use client";

import { useParams } from "next/navigation";
import { TaskListView } from "@/components/app/task-list-view";
import { useLanguage } from "@/lib/use-language";
import { t } from "@/lib/i18n";

export default function TagPage() {
  const lang = useLanguage();
  const { name } = useParams<{ name: string }>();
  const decoded = decodeURIComponent(name);
  return (
    <TaskListView
      title={`#${decoded}`}
      subtitle={t(lang, "view.tag.subtitle")}
      filter={{ tagName: decoded }}
    />
  );
}
