import type { MetadataRoute } from "next";
import { env } from "@sreorg/core";

export default function robots(): MetadataRoute.Robots {
  const base = env.APP_URL.replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/app/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
