import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";
import { BlogList } from "@/components/marketing/blog-list";
import { BlogIndexJsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
  title: "Blog — First Light",
  description:
    "Thoughts on calm productivity, AI-assisted planning, and building a daily practice that sticks.",
  openGraph: {
    title: "Blog — First Light",
    description:
      "Thoughts on calm productivity, AI-assisted planning, and building a daily practice.",
    url: "https://firstlight.to/blog",
  },
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  const posts = getAllPosts().map((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
    date: p.date,
    tags: p.tags,
    lang: p.lang,
    readingTime: p.readingTime,
  }));

  return (
    <>
      <BlogIndexJsonLd posts={posts} />
      <BlogList posts={posts} />
    </>
  );
}
