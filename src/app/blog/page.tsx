import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

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
  const posts = getAllPosts();

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 md:py-24">
      {/* Top bar — matches pricing page nav */}
      <header className="border-b border-border mb-12 -mx-4 md:-mx-6 px-4 md:px-6">
        <div className="max-w-2xl mx-auto h-14 flex items-center justify-between">
          <Link href="/" className="wordmark text-base">
            First Light
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-fg">
            <Link href="/pricing" className="hover:text-fg transition-colors">Pricing</Link>
            <Link href="/blog" className="font-medium text-fg">Blog</Link>
          </nav>
        </div>
      </header>

      <div className="mb-12">
        <h1 className="font-display text-4xl md:text-5xl tracking-tight">
          Blog
        </h1>
        <p className="mt-3 text-muted-fg text-base leading-relaxed max-w-lg">
          On calm productivity, AI-assisted mornings, and building
          intentional daily practices.
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="text-muted-fg italic">Nothing here yet. Check back soon.</p>
      ) : (
        <div className="space-y-10">
          {posts.map((post) => (
            <article key={post.slug} className="group">
              <Link href={`/blog/${post.slug}`} className="block">
                <time className="text-xs uppercase tracking-widest text-muted-fg">
                  {new Date(post.date).toLocaleDateString("en-US", {
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
    </main>
  );
}
