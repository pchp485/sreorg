import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPseoPage, PROFESSIONS, STATES } from "../../../../content/pseo";
import { TDS_SECTIONS } from "@sreorg/tax-india";
import InvoiceGenerator from "../../../../components/InvoiceGenerator";
import { faqsFor, faqJsonLd } from "../../../../content/faqs";

type Params = Promise<{ profession: string; state: string }>;

/**
 * Only the highest-intent combinations are prerendered at build time; the rest
 * render on first request and are then cached. Prerendering all ~1,000 pages
 * would blow past the free tier's build minutes for no ranking benefit.
 */
export function generateStaticParams() {
  const topStates = ["karnataka", "maharashtra", "delhi", "tamil-nadu", "telangana", "uttar-pradesh"];
  return PROFESSIONS.flatMap((p) => topStates.map((state) => ({ profession: p.slug, state })));
}

export const dynamicParams = true;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { profession, state } = await params;
  const page = buildPseoPage(profession, state);
  if (!page) return {};
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/invoice/${page.slug}` },
  };
}

export default async function PseoPage({ params }: { params: Params }) {
  const { profession: professionSlug, state: stateSlug } = await params;
  const page = buildPseoPage(professionSlug, stateSlug);
  if (!page) notFound();

  const { profession, state } = page;
  const tds = TDS_SECTIONS[profession.tdsSection];
  const faqs = faqsFor(page.slug);

  return (
    <>
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: faqJsonLd(faqs) }}
        />
      )}
      <h1>{page.title}</h1>
      <p className="lede">{page.description}</p>

      <h2>The three things {profession.plural} get wrong</h2>
      <ol>
        <li>
          <strong>SAC code.</strong> Services use SAC, not HSN. For {profession.plural} that is
          normally <code>{profession.sac}</code>, taxed at {profession.gstRate}%.
        </li>
        <li>
          <strong>CGST + SGST versus IGST.</strong> Your GSTIN starts with{" "}
          <code>{state.code}</code> for {state.name}. Bill a client also in {state.name} and you
          split the tax into CGST and SGST. Bill anyone outside {state.name} and it is a single
          IGST line — never both.
        </li>
        <li>
          <strong>Forgetting the TDS.</strong> Your client deducts{" "}
          {tds.rate}% under section {profession.tdsSection.split("_")[0]} ({tds.label}) on the
          taxable value, not on the GST. Expect to receive less than the invoice total, and to
          claim the difference back when you file.
        </li>
      </ol>

      <h2>Build the invoice now</h2>
      <p style={{ color: "var(--muted)" }}>
        Pre-filled with SAC {profession.sac} at {profession.gstRate}% and {state.name} as your
        state. Nothing is sent anywhere; it all runs in your browser.
      </p>
      <InvoiceGenerator defaultSac={profession.sac} defaultRate={profession.gstRate} />

      <h2>What a {profession.label.toLowerCase()} usually bills for</h2>
      <ul>{profession.typicalServices.map((s) => <li key={s}>{s}</li>)}</ul>

      <div className="card" style={{ marginTop: 24 }}>
        <strong>And then it goes unpaid for six weeks.</strong>
        <p style={{ marginBottom: 8, color: "var(--muted)" }}>
          Pro follows up automatically on day 3, 7, 14 and 30 past the due date, so you never
          have to write the awkward email. ₹399/month, cancel any time.
        </p>
        <Link className="btn" href="/pricing">See pricing</Link>
      </div>

      {faqs.length > 0 && (
        <>
          <h2>Questions {profession.plural} ask</h2>
          {faqs.map((faq) => (
            <div key={faq.question} style={{ marginBottom: 16 }}>
              <strong>{faq.question}</strong>
              <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{faq.answer}</p>
            </div>
          ))}
        </>
      )}

      <h2>Same format, other states</h2>
      <ul style={{ columns: 2 }}>
        {STATES.filter((s) => s.slug !== state.slug).slice(0, 16).map((s) => (
          <li key={s.slug}>
            <Link href={`/invoice/${profession.slug}/${s.slug}`}>{s.name}</Link>
          </li>
        ))}
      </ul>

      <h2>Other professions in {state.name}</h2>
      <ul style={{ columns: 2 }}>
        {PROFESSIONS.filter((p) => p.slug !== profession.slug).map((p) => (
          <li key={p.slug}>
            <Link href={`/invoice/${p.slug}/${state.slug}`}>{p.label}</Link>
          </li>
        ))}
      </ul>
    </>
  );
}
