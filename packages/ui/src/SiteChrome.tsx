import Link from "next/link";
import type { ReactNode } from "react";

export interface NavLink { href: string; label: string }

/** Shared shell so three products look like one company without three layouts. */
export function SiteChrome({
  brand, links, children, footer,
}: { brand: string; links: NavLink[]; children: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <header className="site">
        <div className="wrap">
          <nav>
            <Link className="brand" href="/">{brand}</Link>
            {links.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
            <Link href="/pricing" style={{ marginLeft: "auto" }}>Pricing</Link>
          </nav>
        </div>
      </header>
      <main className="wrap">{children}</main>
      <footer className="site">
        <div className="wrap">
          {footer ?? "A calculation aid, not tax advice. Confirm anything material with your CA."}
        </div>
      </footer>
    </>
  );
}
