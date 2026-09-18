import Link from "next/link";
import { ProseShell } from "@/components/prose/ProseShell";
import { docsPages } from "@/lib/content";

export const metadata = {
  title: "Docs — Prism Capital",
  description: "How Prism works: buying, NAV and the staleness rule, rebalancing, contracts, and risks.",
};

export default function DocsIndex() {
  const pages = docsPages();
  return (
    <ProseShell active="/docs">
      <div className="mx-auto w-full max-w-[880px] px-5 py-16 sm:px-8 md:py-24">
        <h1 className="text-[44px] leading-[1.05] font-semibold tracking-[-0.03em] text-ink">Docs</h1>
        <p className="mt-4 max-w-[58ch] text-[17px] leading-relaxed text-ink-soft">
          One token that holds a whole basket — how to buy it, how it is priced, what happens when a market closes, and
          what you are trusting when you use it.
        </p>

        <ul className="mt-12 grid gap-3 sm:grid-cols-2">
          {pages.map((page, i) => (
            <li key={page.slug}>
              <Link
                href={`/docs/${page.slug}`}
                className="surface-interactive group flex h-full flex-col rounded-[24px] border border-line p-6"
              >
                <span className="tnum font-mono text-[12px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className="mt-2 text-[19px] font-semibold tracking-[-0.01em] text-ink">{page.title}</span>
                <span className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">{page.description}</span>
                <span className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-ink-faint transition-colors group-hover:text-ink">
                  Read · {page.minutes} min
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="surface-inset mt-10 rounded-[24px] p-6">
          <div className="text-[17px] font-semibold text-ink">Want the full design?</div>
          <p className="mt-2 max-w-[52ch] text-[14.5px] leading-relaxed text-ink-soft">
            The whitepaper covers the mechanics end to end — valuation, creation and redemption, the solver, the trust
            assumptions, and what is still missing.
          </p>
          <Link
            href="/whitepaper"
            className="mt-4 inline-flex rounded-full bg-ink px-4 py-2 text-[14px] font-semibold text-bg hover:bg-bezel"
          >
            Read the whitepaper
          </Link>
        </div>
      </div>
    </ProseShell>
  );
}
