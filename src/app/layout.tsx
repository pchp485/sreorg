import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "GST invoicing that chases payment for you", template: "%s" },
  description:
    "Free GST calculators and invoice formats for Indian freelancers, plus automatic follow-up on every overdue invoice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <header className="site">
          <div className="wrap">
            <nav>
              <Link className="brand" href="/">sreorg</Link>
              <Link href="/tools/gst-calculator">GST calculator</Link>
              <Link href="/tools/tds-calculator">TDS</Link>
              <Link href="/tools/gstin-validator">Validate GSTIN</Link>
              <Link href="/pricing" style={{ marginLeft: "auto" }}>Pricing</Link>
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        <footer className="site">
          <div className="wrap">
            Figures here are a calculation aid, not tax advice. Confirm anything material with your CA.
          </div>
        </footer>
      </body>
    </html>
  );
}
