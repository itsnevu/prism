import Link from "next/link";
import { notFound } from "next/navigation";
import { ProseShell, Toc } from "@/components/prose/ProseShell";
import { Markdown, headings } from "@/lib/markdown";
import { docsPage, docsPages } from "@/lib/content";

export function generateStaticParams() {
  return docsPages().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const page = docsPage((await params).slug);
  if (!page) return { title: "Not found — Prism Capital" };
  return { title: `${page.title} — Prism Docs`, description: page.description };
}

export default async function DocsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = docsPage(slug);
  if (!page) notFound();

  const pages = docsPages();
  const index = pages.findIndex((p) => p.slug === slug);
  const prev = pages[index - 1];
  const next = pages[index + 1];

  return (
    <ProseShell active="/docs">
      <div className="mx-auto grid w-full max-w-[1180px] gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[200px_minmax(0,1fr)_200px]">
        {/* section nav */}
        <nav aria-label="Docs sections" className="hidden lg:block">
          <div className="sticky top-[92px]">
            <Link href="/docs" className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint hover:text-ink">
              Docs
            </Link>
            <ul className="mt-3 space-y-1">
              {pages.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/docs/${p.slug}`}
                    aria-current={p.slug === slug ? "page" : undefined}
                    className={`block rounded-lg px-3 py-1.5 text-[13.5px] leading-snug ${
                      p.slug === slug ? "bg-field font-semibold text-ink" : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <article className="min-w-0">
          <Link
            href="/docs"
            className="mb-6 inline-block text-[13.5px] font-medium text-ink-soft hover:text-ink lg:hidden"
          >
            ← Docs
          </Link>
          <Markdown source={page.body} />

          <nav className="mt-16 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
            {prev ? (
              <Link href={`/docs/${prev.slug}`} className="surface-interactive rounded-2xl border border-line p-4">
                <div className="text-[12px] text-ink-faint">Previous</div>
                <div className="mt-1 text-[15px] font-semibold text-ink">{prev.title}</div>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={`/docs/${next.slug}`} className="surface-interactive rounded-2xl border border-line p-4 text-right">
                <div className="text-[12px] text-ink-faint">Next</div>
                <div className="mt-1 text-[15px] font-semibold text-ink">{next.title}</div>
              </Link>
            )}
          </nav>
        </article>

        <Toc items={headings(page.body)} />
      </div>
    </ProseShell>
  );
}
