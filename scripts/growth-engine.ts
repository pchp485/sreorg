/**
 * The portfolio's acquisition loop. Runs weekly across every product that has a
 * content spec, and writes drafts to disk. The workflow opens a pull request —
 * this never publishes on its own.
 *
 * Compliance has no spec on purpose: its pages are generated from statutory
 * dates that are already exact, and there is nothing an LLM can add to a due
 * date except risk.
 */
import { runContentEngine, type ContentSpec } from "@sreorg/growth";
import { invoicingSpec } from "../apps/invoicing/src/content/growth-spec";
import { payrollSpec } from "../apps/payroll/src/content/growth-spec";

const SPECS: ContentSpec[] = [invoicingSpec, payrollSpec];

async function main() {
  let total = 0;
  for (const spec of SPECS) {
    try {
      total += await runContentEngine(spec);
    } catch (err) {
      // One product's failure must not stop the others from getting their batch.
      console.error(`[growth] ${spec.product} failed`, err);
    }
  }
  console.log(`[growth] wrote ${total} new FAQ entries`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
