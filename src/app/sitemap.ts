import type { MetadataRoute } from "next";

const SITE = "https://firstlight.to";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
    return [
        { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
            { url: `${SITE}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
                { url: `${SITE}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
                    { url: `${SITE}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
                        { url: `${SITE}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
                            { url: `${SITE}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
                              ];
                              }
                              
