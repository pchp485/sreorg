import type { MetadataRoute } from "next";
import { env } from "@sreorg/core";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.APP_URL.replace(/\/$/, "");
  const now = new Date();
  const thisYear = now.getUTCFullYear();

  return [
    { url: base, lastModified: now, priority: 1 },
    { url: `${base}/pricing`, lastModified: now, priority: 0.9 },
    ...[thisYear, thisYear + 1].flatMap((year) =>
      MONTHS.map((month) => ({
        url: `${base}/due/${year}/${month}`, lastModified: now, priority: 0.7,
      }))),
  ];
}
