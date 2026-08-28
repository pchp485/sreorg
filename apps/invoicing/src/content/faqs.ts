import data from "./generated/faqs.json";
import type { Faq } from "@sreorg/growth";

const file = data as { generatedAt: string | null; entries: Faq[] };

export function faqsFor(page: string): Faq[] {
  return file.entries.filter((f) => f.page === page);
}
export { faqJsonLd } from "@sreorg/growth";
export type { Faq };
