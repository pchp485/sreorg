import type { Metadata } from "next";
import { SiteChrome } from "@sreorg/ui";
import "@sreorg/ui/globals.css";

export const metadata: Metadata = {
  title: { default: "Every statutory deadline, a week before the penalty", template: "%s" },
  description:
    "Free calendar of GST, TDS, PF, ESI and advance tax deadlines for Indian businesses, with what each one costs to miss.",
};

const LINKS = [{ href: "/", label: "What's due" }];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body><SiteChrome brand="Deadlines" links={LINKS}>{children}</SiteChrome></body>
    </html>
  );
}
