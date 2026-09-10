import Link from "next/link";
import { ProseShell } from "@/components/prose/ProseShell";
import { blogPosts, formatDate } from "@/lib/content";

export const metadata = {
  title: "Blog — Prism Capital",
  description: "Notes on index design, execution, and what we shipped.",
};

export default function BlogIndex() {
  const posts = blogPosts();
  return (
    <ProseShell active="/blog">
      <div className="mx-auto w-full max-w-[820px] px-5 py-16 sm:px-8 md:py-24">
        <h1 className="text-[44px] leading-[1.05] font-semibold tracking-[-0.03em] text-ink">Blog</h1>
        <p className="mt-4 max-w-[56ch] text-[17px] leading-relaxed text-ink-soft">
          Notes on why index execution is the part that decides the outcome, and what we have built to take it off your
          hands.
        </p>

        <ul className="mt-14 divide-y divide-line border-t border-line">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="group block py-8">
                <div className="tnum flex items-center gap-3 font-mono text-[12.5px] text-ink-faint">
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                  <span>·</span>
                  <span>{post.minutes} min</span>
                </div>
                <h2 className="mt-2 text-[27px] leading-[1.15] font-semibold tracking-[-0.02em] text-ink group-hover:underline group-hover:decoration-green group-hover:underline-offset-[6px]">
                  {post.title}
                </h2>
                <p className="mt-3 max-w-[60ch] text-[16px] leading-relaxed text-ink-soft">{post.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </ProseShell>
  );
}
