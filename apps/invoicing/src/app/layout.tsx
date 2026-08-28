import type { Metadata } from "next";
import { SiteChrome } from "@sreorg/ui";
import "@sreorg/ui/globals.css";

export const metadata: Metadata = {
  title: { default: "GST invoicing that chases payment for you", template: "%s" },
  description:
    "Free GST calculators and invoice formats for Indian freelancers, plus automatic follow-up on every overdue invoice.",
};

const LINKS = [
  { href: "/tools/gst-calculator", label: "GST calculator" },
  { href: "/tools/tds-calculator", label: "TDS" },
  { href: "/tools/gstin-validator", label: "Validate GSTIN" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body><SiteChrome brand="Invoices" links={LINKS}>{children}</SiteChrome></body>
    </html>
  );
}
