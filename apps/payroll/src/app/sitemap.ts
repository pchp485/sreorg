import type { MetadataRoute } from "next";
import { env } from "@sreorg/core";
import { allSalaryPages } from "../content/pseo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.APP_URL.replace(/\/$/, "");
  const now = new Date();
  return [
    { url: base, lastModified: now, priority: 1 },
    { url: `${base}/pricing`, lastModified: now, priority: 0.9 },
    ...allSalaryPages().map((p) => ({
      url: `${base}/salary/${p.slug}`, lastModified: now, priority: 0.6,
    })),
  ];
}
