import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { TOOLS } from "@/content/tools";
import { allPseoPages } from "@/content/pseo";

/**
 * Every generated page is listed. This is how ~1,000 long-tail pages get
 * discovered without a single backlink.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.APP_URL.replace(/\/$/, "");
  const now = new Date();

  return [
    { url: base, lastModified: now, priority: 1 },
    { url: `${base}/pricing`, lastModified: now, priority: 0.9 },
    ...TOOLS.map((t) => ({ url: `${base}/tools/${t.slug}`, lastModified: now, priority: 0.9 })),
    ...allPseoPages().map((p) => ({
      url: `${base}/invoice/${p.slug}`,
      lastModified: now,
      priority: 0.6,
    })),
  ];
}
