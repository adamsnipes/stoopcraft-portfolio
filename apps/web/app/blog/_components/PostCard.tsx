import Link from 'next/link';
import type { PostMeta } from '@/lib/marketing-blog/posts';
import { formatDate, categoryUrl } from '@/lib/marketing-blog/config';

// Article card used on the blog index, category hubs, and related-reading.
// Plain <img> (not next/image): covers are self-hosted under /public and the
// CSP already allows img-src 'self', so no loader/config is needed.
export function PostCard({ post, priority = false }: { post: PostMeta; priority?: boolean }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-ink-900/10 bg-white transition-shadow hover:shadow-[0_16px_40px_-24px_rgba(10,10,10,0.35)]">
      <Link href={`/blog/${post.slug}`} className="block overflow-hidden">
        <div className="aspect-[16/9] w-full bg-cream-100">
          {post.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.cover}
              alt={post.coverAlt}
              loading={priority ? 'eager' : 'lazy'}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-900 to-ink-700">
              <span className="font-display text-lg font-semibold text-cream-50/90">
                StoopCraft
              </span>
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        {post.category && (
          <Link
            href={categoryUrl(post.category.slug)}
            className="mb-2 inline-block text-xs font-semibold uppercase tracking-wider text-amber-accent hover:underline"
          >
            {post.category.label}
          </Link>
        )}
        <h3 className="font-display text-lg font-semibold leading-snug text-ink-900">
          <Link href={`/blog/${post.slug}`} className="hover:text-amber-accent">
            {post.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-ink-700">
          {post.description}
        </p>
        <p className="mt-4 text-xs text-ink-700/70">{formatDate(post.publishedDate)}</p>
      </div>
    </article>
  );
}
