import Link from "next/link";
import { ProseShell } from "@/components/prose/ProseShell";
import { LINKS } from "@/lib/links";

export const metadata = { title: "Not found — Prism Capital" };

const ELSEWHERE = [
  { href: LINKS.app, label: "Indexes", note: "The three live baskets, priced from the chain." },
  { href: LINKS.docs, label: "Docs", note: "How buying, pricing and rebalancing work." },
  { href: "/whitepaper", label: "Whitepaper", note: "The full design, end to end." },
  { href: LINKS.blog, label: "Blog", note: "Notes on index design and what shipped." },
];

export default function NotFound() {
  return (
    <ProseShell>
      <div className="mx-auto w-full max-w-[640px] px-5 py-24 sm:px-8">
        <p className="tnum font-mono text-[13px] text-ink-faint">404</p>
        <h1 className="mt-3 text-[38px] leading-[1.1] font-semibold tracking-[-0.03em] text-ink">
          There is nothing at this address.
        </h1>
        <p className="mt-4 text-[16.5px] leading-relaxed text-ink-soft">
          The page either moved or never existed. Here is everything that does.
        </p>

        <ul className="mt-10 divide-y divide-line border-y border-line">
          {ELSEWHERE.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="group flex items-baseline justify-between gap-4 py-4">
                <span>
                  <span className="text-[16px] font-semibold text-ink group-hover:underline group-hover:decoration-green group-hover:underline-offset-4">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-[14px] text-ink-soft">{item.note}</span>
                </span>
                <span aria-hidden className="text-ink-faint transition-colors group-hover:text-ink">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </ProseShell>
  );
}
