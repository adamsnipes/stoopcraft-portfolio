import type { PostMeta } from '@/lib/marketing-blog/posts';
import { PostCard } from './PostCard';

// "Related reading" module (UNIVERSAL §21) — also the structural backstop
// against orphaned posts (§20). Rendered only when there's something to show.
export function RelatedPosts({ posts }: { posts: PostMeta[] }) {
  if (!posts.length) return null;
  return (
    <section className="mx-auto mt-16 max-w-5xl border-t border-ink-900/10 px-6 pt-12">
      <h2 className="font-display text-xl font-semibold text-ink-900">Keep reading</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((p) => (
          <PostCard key={p.slug} post={p} />
        ))}
      </div>
    </section>
  );
}
