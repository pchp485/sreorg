import data from "./generated/faqs.json";

export interface Faq {
  /** Page slug this FAQ attaches to, e.g. "freelance-designer/karnataka" or "tools/gst-calculator". */
  page: string;
  question: string;
  answer: string;
}

interface FaqFile { generatedAt: string | null; entries: Faq[] }

const file = data as FaqFile;

export function faqsFor(page: string): Faq[] {
  return file.entries.filter((f) => f.page === page);
}

export function allFaqs(): Faq[] {
  return file.entries;
}

/** JSON-LD so the FAQ can win a rich result rather than just sitting on the page. */
export function faqJsonLd(faqs: Faq[]): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  });
}
