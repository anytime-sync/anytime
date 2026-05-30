import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    return {
          rules: [
            {
                      userAgent: "*",
                      allow: "/",
                      disallow: ["/api/", "/app/", "/admin/", "/auth/"],
            },
                ],
          sitemap: "https://firstlight.to/sitemap.xml",
          host: "https://firstlight.to",
    };
}
