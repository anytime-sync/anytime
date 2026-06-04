import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import readingTime from "reading-time";

const POSTS_DIR = path.join(process.cwd(), "src/content/blog");

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  author: string;
  tags: string[];
  lang: "en" | "zh-TW" | "ja" | "ko";
  image?: string;
  imageAlt?: string;
  readingTime: string;
  content: string;       // raw markdown
  contentHtml?: string;  // rendered HTML
}

/** Get all blog post slugs (for generateStaticParams). */
export function getAllSlugs(): string[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

/** Get metadata for all posts (sorted newest-first). */
export function getAllPosts(): BlogPost[] {
  return getAllSlugs()
    .map((slug) => getPost(slug))
    .filter((p): p is BlogPost => p !== null)
    .sort((a, b) => (a.date > b.date ? -1 : 1));
}

/** Get a single post by slug. Returns null if not found. */
export function getPost(slug: string): BlogPost | null {
  const filePath = path.join(POSTS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const stats = readingTime(content);

  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    date: data.date ?? new Date().toISOString().split("T")[0],
    updated: data.updated,
    author: data.author ?? "Aaron Cheng",
    tags: data.tags ?? [],
    lang: data.lang ?? "en",
    image: data.image,
    imageAlt: data.imageAlt ?? data.title,
    readingTime: stats.text,
    content,
  };
}

/** Render markdown to HTML. */
export async function renderMarkdown(markdown: string): Promise<string> {
  const result = await remark().use(html, { sanitize: false }).process(markdown);
  return result.toString();
}
