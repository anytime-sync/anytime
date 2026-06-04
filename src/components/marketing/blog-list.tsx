"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlogNav } from "./blog-nav";
import {
  readStoredLanguage,
  type LanguageCode,
} from "@/lib/i18n";

interface BlogPostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  lang: string;
  readingTime: string;
}

export function BlogList({ posts }: { posts: BlogPostMeta[] }) {
  const [lang, setLang] = useState<LanguageCode>("en");

  useEffect(() => {
    setLang(readStoredLanguage());
    function onStorage(e: StorageEvent) {
      if (e.key === "fl.language") setLang(readStoredLanguage());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Filter posts: show posts matching current language.
  // If no posts exist in the current language, fall back to EN.
  const langPosts = posts.filter((p) => p.lang === lang);
  const filtered = langPosts.length > 0 ? langPosts : posts.filter((p) => p.lang === "en");

  // Date locale for display
  const dateLocale = lang.startsWith("zh") ? "zh-TW"
    : lang === "ja" ? "ja-JP"
    : lang === "ko" ? "ko-KR"
    : "en-US";

  return (
    <>
      <BlogNav activePage="blog" onLangChange={setLang} />

      <div className="mb-12">
        <h1 className="font-display text-4xl md:text-5xl tracking-tight">
          Blog
        </h1>
        <p className="mt-3 text-muted-fg text-base leading-relaxed max-w-lg">
          {lang.startsWith("zh")
            ? "關於從容的生產力、AI 輔助的早晨、與刻意建立的日常習慣。"
            : lang === "ja"
            ? "穏やかな生産性、AIアシストの朝、意図的な日課づくりについて。"
            : lang === "ko"
            ? "차분한 생산성, AI 기반 아침 루틴, 의도적인 일상 습관에 대해."
            : "On calm productivity, AI-assisted mornings, and building intentional daily practices."}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-fg italic">
          {lang.startsWith("zh")
            ? "還沒有文章，請稍後再來。"
            : "Nothing here yet. Check back soon."}
        </p>
      ) : (
        <div className="space-y-10">
          {filtered.map((post) => (
            <article key={post.slug} className="group">
              <Link href={`/blog/${post.slug}`} className="block">
                <time className="text-xs uppercase tracking-widest text-muted-fg">
                  {new Date(post.date).toLocaleDateString(dateLocale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {" · "}
                  {post.readingTime}
                </time>
                <h2 className="mt-1.5 font-display text-xl md:text-2xl tracking-tight group-hover:text-accent transition-colors">
                  {post.title}
                </h2>
                <p className="mt-2 text-muted-fg text-sm leading-relaxed line-clamp-2">
                  {post.description}
                </p>
                {post.tags.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] uppercase tracking-wider text-accent-fg bg-accent/90 rounded-full px-2 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
