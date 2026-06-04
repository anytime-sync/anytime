import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllSlugs, getPost, renderMarkdown } from "@/lib/blog";
import { BlogPostJsonLd } from "@/components/json-ld";

interface Props {
  params: { slug: string };
}

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const post = getPost(params.slug);
  if (!post) return {};
  return {
    title: `${post.title} — First Light`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://firstlight.to/blog/${post.slug}`,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      authors: [post.author],
      tags: post.tags,
      ...(post.image && {
        images: [{ url: post.image, alt: post.imageAlt }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      ...(post.image && { images: [post.image] }),
    },
    alternates: { canonical: `/blog/${post.slug}` },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const post = getPost(params.slug);
  if (!post) notFound();

  const contentHtml = await renderMarkdown(post.content);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 md:py-24">
      <BlogPostJsonLd
        title={post.title}
        description={post.description}
        date={post.date}
        updated={post.updated}
        author={post.author}
        url={`https://firstlight.to/blog/${post.slug}`}
        image={post.image}
      />
      <nav className="mb-10">
        <Link
          href="/blog"
          className="text-xs uppercase tracking-widest text-muted-fg hover:text-fg transition-colors"
        >
          ← Back to blog
        </Link>
      </nav>

      <article>
        <header className="mb-10">
          <time className="text-xs uppercase tracking-widest text-muted-fg">
            {new Date(post.date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            {" · "}
            {post.readingTime}
          </time>
          <h1 className="mt-3 font-display text-3xl md:text-4xl tracking-tight leading-tight">
            {post.title}
          </h1>
          <p className="mt-3 text-muted-fg text-base leading-relaxed">
            {post.description}
          </p>
          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] uppercase tracking-wider text-muted-fg/70 border border-border rounded-full px-2 py-0.5"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <div
          className="prose prose-neutral dark:prose-invert prose-headings:font-display prose-headings:tracking-tight prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      </article>

      <footer className="mt-16 pt-8 border-t border-border">
        <div className="flex items-center justify-between">
          <Link
            href="/blog"
            className="text-sm text-muted-fg hover:text-fg transition-colors"
          >
            ← All posts
          </Link>
          <Link
            href="/"
            className="btn-primary text-sm h-9 px-4"
          >
            Try First Light — free
          </Link>
        </div>
      </footer>
    </main>
  );
}
