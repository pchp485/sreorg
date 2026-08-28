import { readFileSync, writeFileSync, existsSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { pageFunnel, env, type ProductId } from "@sreorg/core";

export interface Faq { page: string; question: string; answer: string }
interface FaqFile { generatedAt: string | null; entries: Faq[] }

export interface ContentTarget {
  /** Page key the FAQs attach to, matching the app's routing. */
  page: string;
  /** Human description of the page, used in the prompt. */
  description: string;
  /**
   * The ONLY numbers the model is allowed to use. Anything not in here it must
   * refuse to write about rather than guess.
   */
  verifiedFacts: string[];
}

export interface ContentSpec {
  product: ProductId;
  /** Path to the app's generated FAQ JSON file. */
  outputPath: string;
  /** Produces candidate pages to write about, given what already has content. */
  candidates(existing: Set<string>): ContentTarget[];
  maxPagesPerRun?: number;
}

const SYSTEM = `You write short FAQ entries for Indian tax and compliance software aimed at freelancers and small businesses.

Rules you must not break:
- Use ONLY the verified facts given to you in the prompt. Never invent SAC codes, HSN codes, tax rates, TDS rates, section numbers, thresholds, due dates or penalty amounts.
- If answering a question would need a number you were not given, do not write that question.
- Two to four sentences per answer. Plain English, no marketing language, no exclamation marks.
- Write for someone about to do the thing and unsure about one specific detail.

Return ONLY a JSON array: [{"question": "...", "answer": "..."}]. No prose, no code fences.`;

function loadFaqs(path: string): FaqFile {
  if (!existsSync(path)) return { generatedAt: null, entries: [] };
  return JSON.parse(readFileSync(path, "utf8")) as FaqFile;
}

/**
 * Ranks candidates by what the funnel says is broken. A page with traffic and no
 * conversions is the best thing to improve; a page already converting is left
 * alone, because rewriting what works is how a content engine destroys value.
 */
export async function prioritise(
  spec: ContentSpec,
  existing: Set<string>,
): Promise<ContentTarget[]> {
  const candidates = spec.candidates(existing);
  const limit = spec.maxPagesPerRun ?? 8;

  let funnel: Awaited<ReturnType<typeof pageFunnel>> = [];
  try {
    funnel = await pageFunnel(30, spec.product);
  } catch (err) {
    console.warn(`[growth:${spec.product}] no analytics yet, using seed order`, err);
    return candidates.slice(0, limit);
  }

  const viewsByPage = new Map<string, number>();
  const convertingPages = new Set<string>();
  for (const row of funnel) {
    const key = row.path.replace(/^\//, "");
    viewsByPage.set(key, row.views);
    if (row.conversions > 0) convertingPages.add(key);
  }

  return candidates
    .filter((c) => !convertingPages.has(c.page))
    .sort((a, b) => (viewsByPage.get(b.page) ?? 0) - (viewsByPage.get(a.page) ?? 0))
    .slice(0, limit);
}

async function draft(client: Anthropic, target: ContentTarget): Promise<Faq[]> {
  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{
      role: "user",
      content: `Write 3 FAQ entries for the page: "${target.description}".

Verified facts you may use, and only these:
${target.verifiedFacts.map((f) => `- ${f}`).join("\n")}`,
    }],
  });

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()
    .replace(/^```(?:json)?\s*|\s*```$/g, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.warn(`[growth] unparseable response for ${target.page}`);
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((e): e is { question: string; answer: string } =>
      !!e && typeof e === "object"
      && typeof (e as Faq).question === "string" && typeof (e as Faq).answer === "string")
    .slice(0, 3)
    .map((e) => ({ page: target.page, question: e.question.trim(), answer: e.answer.trim() }));
}

/**
 * Drafts content and writes it to disk. It never publishes: the workflow opens a
 * pull request. This is tax content, and a wrong number costs a reader money and
 * costs the site its rankings — a human reading a small weekly diff is the only
 * real safety mechanism there is.
 */
export async function runContentEngine(spec: ContentSpec): Promise<number> {
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");

  const current = loadFaqs(spec.outputPath);
  const existing = new Set(current.entries.map((e) => e.page));
  const targets = await prioritise(spec, existing);

  if (targets.length === 0) {
    console.log(`[growth:${spec.product}] nothing to write this cycle`);
    return 0;
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const added: Faq[] = [];

  for (const target of targets) {
    const faqs = await draft(client, target);
    if (faqs.length > 0) {
      added.push(...faqs);
      console.log(`[growth:${spec.product}] drafted ${faqs.length} FAQs for ${target.page}`);
    }
  }

  if (added.length === 0) return 0;

  writeFileSync(spec.outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    entries: [...current.entries, ...added].sort((a, b) => a.page.localeCompare(b.page)),
  }, null, 2) + "\n");

  return added.length;
}

/** JSON-LD so an FAQ can win a rich result rather than just sitting on the page. */
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
