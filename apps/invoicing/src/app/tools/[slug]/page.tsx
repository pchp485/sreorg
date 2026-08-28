import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TOOLS, findTool } from "../../../content/tools";
import GstCalculator from "../../../components/GstCalculator";
import GstinValidator from "../../../components/GstinValidator";
import TdsCalculator from "../../../components/TdsCalculator";
import InvoiceGenerator from "../../../components/InvoiceGenerator";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = findTool(slug);
  if (!tool) return {};
  return {
    title: `${tool.name} — free, no signup`,
    description: tool.description,
    alternates: { canonical: `/tools/${tool.slug}` },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = findTool(slug);
  if (!tool) notFound();

  return (
    <>
      <h1>{tool.name}</h1>
      <p className="lede">{tool.headline}</p>

      {slug === "gst-calculator" && <GstCalculator />}
      {slug === "gstin-validator" && <GstinValidator />}
      {slug === "tds-calculator" && <TdsCalculator />}
      {slug === "invoice-generator" && <InvoiceGenerator />}

      <h2>About this tool</h2>
      <p>{tool.description}</p>

      <div className="card" style={{ marginTop: 24 }}>
        <strong>Getting paid is the harder half.</strong>
        <p style={{ marginBottom: 8, color: "var(--muted)" }}>
          Pro sends a polite reminder on day 3, 7, 14 and 30 past due, every time, without you
          having to feel awkward about it. ₹399/month.
        </p>
        <Link className="btn" href="/pricing">See pricing</Link>
      </div>

      <h2>Other free tools</h2>
      <ul>
        {TOOLS.filter((t) => t.slug !== slug).map((t) => (
          <li key={t.slug}><Link href={`/tools/${t.slug}`}>{t.name}</Link> — {t.headline}</li>
        ))}
      </ul>
    </>
  );
}
