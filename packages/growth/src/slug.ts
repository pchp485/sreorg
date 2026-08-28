export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface StateSlug { code: string; name: string; slug: string }

/** State list shared by every product's programmatic-SEO surface. */
export function stateSlugs(stateCodes: Record<string, string>): StateSlug[] {
  return Object.entries(stateCodes)
    .filter(([code]) => code !== "97")
    .map(([code, name]) => ({ code, name, slug: slugify(name) }));
}
