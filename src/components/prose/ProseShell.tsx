import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/Logo";
import { LINKS } from "@/lib/links";

const NAV = [
  { href: LINKS.docs, label: "Docs" },
  { href: "/whitepaper", label: "Whitepaper" },
  { href: LINKS.blog, label: "Blog" },
] as const;

/** Header, footer and page frame shared by every prose page (docs, whitepaper, blog, legal). */
export function ProseShell({ children, active }: { children: ReactNode; active?: string }) {
  return (
    <div className="lp flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-[68px] w-full max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Prism home">
            <Wordmark />
          </Link>
          {/* Below sm the three section links plus the pill do not fit; the footer carries them. */}
          <nav className="flex items-center gap-1">
            <span className="hidden items-center gap-1 sm:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active === item.href ? "page" : undefined}
                  className={`rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors ${
                    active === item.href ? "bg-field text-ink" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </span>
            <Link
              href={LINKS.app}
              className="rounded-full bg-ink px-4 py-2 text-[14px] font-semibold whitespace-nowrap text-bg transition-colors hover:bg-bezel sm:ml-1.5"
            >
              Open app
            </Link>
          </nav>
        </div>
      </header>

      <main className="prose-balance flex-1">{children}</main>

      <footer className="mt-24 border-t border-line">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="max-w-md text-[13px] text-ink-faint">
            Prices go down as well as up. Index tokens track the NAV of their underlying basket. Not audited, not
            deployed to a live network.
          </p>
          <nav className="flex flex-wrap gap-5 text-[13.5px] text-ink-soft">
            <Link href={LINKS.app} className="hover:text-ink">
              Indexes
            </Link>
            <Link href={LINKS.docs} className="hover:text-ink">
              Docs
            </Link>
            <Link href="/whitepaper" className="hover:text-ink">
              Whitepaper
            </Link>
            <Link href={LINKS.blog} className="hover:text-ink">
              Blog
            </Link>
            <Link href={LINKS.terms} className="hover:text-ink">
              Terms
            </Link>
            <Link href={LINKS.privacy} className="hover:text-ink">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** Sticky table of contents built from a document's headings. */
export function Toc({ items }: { items: { id: string; text: string; level: number }[] }) {
  if (items.length < 3) return null;
  return (
    <nav aria-label="On this page" className="sticky top-[92px] hidden max-h-[calc(100vh-120px)] overflow-y-auto lg:block">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint">On this page</div>
      <ul className="mt-3 space-y-1.5 border-l border-line">
        {items.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`block border-l-2 border-transparent py-0.5 text-[13px] leading-snug text-ink-soft hover:border-green hover:text-ink ${
                h.level === 3 ? "pl-6" : "pl-3.5"
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
