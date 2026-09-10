import Link from "next/link";
import { notFound } from "next/navigation";
import { ProseShell } from "@/components/prose/ProseShell";
import { Markdown } from "@/lib/markdown";
import { blogPost, blogPosts, formatDate } from "@/lib/content";

export function generateStaticParams() {
  return blogPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const post = blogPost((await params).slug);
  if (!post) return { title: "Not found — Prism Capital" };
  return { title: `${post.title} — Prism Capital`, description: post.description };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = blogPost(slug);
  if (!post) notFound();

  const others = blogPosts().filter((p) => p.slug !== slug);

  return (
    <ProseShell active="/blog">
      <article className="mx-auto w-full max-w-[72ch] px-5 py-14 sm:px-8">
        <Link href="/blog" className="text-[13.5px] font-medium text-ink-soft hover:text-ink">
          ← Blog
        </Link>
        <div className="tnum mt-8 flex items-center gap-3 font-mono text-[12.5px] text-ink-faint">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span>·</span>
          <span>{post.minutes} min read</span>
        </div>
        <div className="mt-3">
          <Markdown source={post.body} />
        </div>

        {others.length > 0 && (
          <div className="mt-20 border-t border-line pt-8">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Keep reading</div>
            <ul className="mt-4 space-y-4">
              {others.map((p) => (
                <li key={p.slug}>
                  <Link href={`/blog/${p.slug}`} className="group block">
                    <div className="text-[17px] font-semibold text-ink group-hover:underline group-hover:decoration-green group-hover:underline-offset-4">
                      {p.title}
                    </div>
                    <div className="mt-1 text-[14px] text-ink-soft">{p.description}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </ProseShell>
  );
}
