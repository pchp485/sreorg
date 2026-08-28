import type { Metadata } from "next";
import { SiteChrome } from "@sreorg/ui";
import "@sreorg/ui/globals.css";

export const metadata: Metadata = {
  title: { default: "Payslips and statutory deductions, on autopilot", template: "%s" },
  description:
    "Free in-hand salary calculator with PF, ESI, professional tax and TDS worked out. Pro issues every payslip on the 1st without you touching it.",
};

const LINKS = [
  { href: "/", label: "Salary calculator" },
  { href: "/salary/1200000/karnataka", label: "₹12L in Karnataka" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body><SiteChrome brand="Payslips" links={LINKS}>{children}</SiteChrome></body>
    </html>
  );
}
