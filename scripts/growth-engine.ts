/**
 * The acquisition loop. Runs weekly.
 *
 * It reads which pages actually produced paying customers, drafts new FAQ
 * content for the pages closest to converting, and writes it to a JSON file.
 * The workflow then opens a pull request.
 *
 * It deliberately does NOT publish on its own. This is tax-adjacent content:
 * a hallucinated SAC code or TDS rate costs a reader real money and costs the
 * site its rankings. A human approving a small weekly PR is the whole safety
 * mechanism, and it takes about two minutes.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { pageFunnel } from "../src/lib/analytics";
import { PROFESSIONS, STATES } from "../src/content/pseo";
import { env } from "../src/lib/env";
import type { Faq } from "../src/content/faqs";

const OUT = resolve(process.cwd(), "src/content/generated/faqs.json");
const MAX_NEW_PAGES = 8;

interface Target { page: string; profession: string; state: string; views: number }

/**
 * Pick what to write about. Priority order:
 *   1. Pages with traffic but no conversions — the offer is not landing there.
 *   2. Untouched profession x state combos in the biggest states.
 * Never rewrite a page that is already converting; do not break what works.
 */
export async function pickTargets(existing: Set<string>): Promise<Target[]> {
  const targets: Target[] = [];

  let funnel: Awaited<ReturnType<typeof pageFunnel>> = [];
  try {
    funnel = await pageFunnel(30);
  } catch (err) {
    console.warn("[growth] no analytics available, falling back to seed targets", err);
  }

  for (const row of funnel) {
    const match = row.path.match(/^\/invoice\/([^/]+)\/([^/]+)$/);
    if (!match) continue;
    const page = `${match[1]}/${match[2]}`;
    if (existing.has(page) || row.conversions > 0) continue;
    targets.push({ page, profession: match[1], state: match[2], views: row.views });
    if (targets.length >= MAX_NEW_PAGES) return targets;
  }

  const bigStates = ["karnataka", "maharashtra", "delhi", "tamil-nadu", "telangana", "gujarat"];
  for (const state of bigStates) {
    for (const profession of PROFESSIONS) {
      const page = `${profession.slug}/${state}`;
      if (existing.has(page) || targets.some((t) => t.page === page)) continue;
      targets.push({ page, profession: profession.slug, state, views: 0 });
      if (targets.length >= MAX_NEW_PAGES) return targets;
    }
  }

  return targets;
}

const SYSTEM = `You write short FAQ entries for an Indian GST invoicing site aimed at freelancers.

Rules you must not break:
- Only state facts you are confident are correct about Indian GST and TDS law.
- Never invent SAC codes, GST rates, TDS rates, section numbers, or thresholds. Use only the ones given to you in the prompt.
- If a question needs a number you were not given, do not write that question.
- Two to four sentences per answer. Plain English, no marketing language, no exclamation marks.
- Write for someone who is about to send an invoice and is unsure about one specific thing.

Return ONLY a JSON array: [{"question": "...", "answer": "..."}]. No prose, no code fences.`;

async function draftFaqs(client: Anthropic, target: Target): Promise<Faq[]> {
  const profession = PROFESSIONS.find((p) => p.slug === target.profession);
  const state = STATES.find((s) => s.slug === target.state);
  if (!profession || !state) return [];

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{
      role: "user",
      content: `Write 3 FAQ entries for the page "GST invoice format for ${profession.plural} in ${state.name}".

Verified facts you may use (and only these numbers):
- SAC code for this profession: ${profession.sac}
- GST rate: ${profession.gstRate}%
- State: ${state.name}, GST state code ${state.code}
- Intra-state supply splits into CGST + SGST at half the rate each; inter-state is a single IGST charge at the full rate.
- TDS section: ${profession.tdsSection.split("_")[0]}
- TDS is deducted on taxable value only, never on the GST component.
- Invoice totals are rounded to the nearest rupee under Section 170 of the CGST Act.`,
    }],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
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
    .filter((entry): entry is { question: string; answer: string } =>
      !!entry && typeof entry === "object"
      && typeof (entry as any).question === "string"
      && typeof (entry as any).answer === "string")
    .slice(0, 3)
    .map((entry) => ({ page: target.page, question: entry.question.trim(), answer: entry.answer.trim() }));
}

async function main() {
  if (!env.ANTHROPIC_API_KEY) {
    console.error("[growth] ANTHROPIC_API_KEY is not set");
    process.exit(1);
  }

  const current = JSON.parse(readFileSync(OUT, "utf8")) as { generatedAt: string | null; entries: Faq[] };
  const existing = new Set(current.entries.map((e) => e.page));

  const targets = await pickTargets(existing);
  if (targets.length === 0) {
    console.log("[growth] nothing to write this cycle");
    return;
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const added: Faq[] = [];

  for (const target of targets) {
    const faqs = await draftFaqs(client, target);
    if (faqs.length > 0) {
      added.push(...faqs);
      console.log(`[growth] drafted ${faqs.length} FAQs for ${target.page}`);
    }
  }

  if (added.length === 0) {
    console.log("[growth] no usable drafts produced");
    return;
  }

  const next = {
    generatedAt: new Date().toISOString(),
    entries: [...current.entries, ...added].sort((a, b) => a.page.localeCompare(b.page)),
  };
  writeFileSync(OUT, JSON.stringify(next, null, 2) + "\n");
  console.log(`[growth] wrote ${added.length} new FAQs across ${targets.length} pages`);
}

if (process.argv[1]?.endsWith("growth-engine.ts")) {
  main().then(() => process.exit(0)).catch((err) => { console.error("[growth] failed", err); process.exit(1); });
}
