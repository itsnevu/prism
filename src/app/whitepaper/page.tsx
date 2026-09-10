import { ProseShell, Toc } from "@/components/prose/ProseShell";
import { Markdown, headings } from "@/lib/markdown";
import { whitepaper, formatDate } from "@/lib/content";

export const metadata = {
  title: "Whitepaper — Prism Capital",
  description: "The design, mechanics, and failure modes of the Prism index vault.",
};

export default function WhitepaperPage() {
  const doc = whitepaper();
  return (
    <ProseShell active="/whitepaper">
      <div className="mx-auto grid w-full max-w-[1180px] gap-14 px-5 py-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_220px]">
        <article className="min-w-0 max-w-[72ch]">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-faint">
            <span className="rounded-full bg-field px-2.5 py-1 font-semibold text-ink-soft">Whitepaper</span>
            <span>{formatDate(doc.date)}</span>
            <span>·</span>
            <span>{doc.minutes} min read</span>
          </div>
          <div className="mt-6">
            <Markdown source={doc.body} />
          </div>
        </article>
        <Toc items={headings(doc.body)} />
      </div>
    </ProseShell>
  );
}
