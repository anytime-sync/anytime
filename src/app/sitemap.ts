import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog";

const SITE = "https://firstlight.to";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const blogPosts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${SITE}/blog/${post.slug}`,
    lastModified: new Date(post.updated ?? post.date),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...blogPosts];
}
