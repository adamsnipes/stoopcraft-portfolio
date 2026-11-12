import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClientByIdAsAdmin } from '@/lib/tenant';
import { listPostsForClient } from '@/lib/blog/posts';
import { NewPostButton } from './NewPostButton';
import { BrandingPanel } from '../BrandingPanel';
import { SectionHeading } from '../../../ui';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-ink-900/5 text-ink-700',
  in_review: 'bg-amber-accent/10 text-amber-accent',
  published: 'bg-emerald-50 text-emerald-700',
};

export default async function BlogListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClientByIdAsAdmin(id).catch(() => null);
  if (!client) notFound();

  const posts = await listPostsForClient(id);

  return (
    <div>
      {/* Blog branding — display name, blog title and logo all render on the
          blog masthead, so they belong on this tab rather than the detail page. */}
      <BrandingPanel
        clientId={id}
        currentDisplayName={client.business_display_name ?? null}
        currentBlogTitle={client.blog_title ?? null}
        fallbackName={client.business_name}
        currentLogoUrl={client.logo_url ?? null}
      />

      <SectionHeading count={posts.length} action={<NewPostButton clientId={id} />}>
        Posts
      </SectionHeading>
      <p className="-mt-2 mb-3 text-sm text-ink-700/60">
        Published posts appear at <code className="text-xs">/blog</code> on the client&apos;s site.
      </p>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-900/15 bg-white p-10 text-center text-sm text-ink-700/60">
          No posts yet — create your first one.
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/admin/clients/${id}/blog/${p.id}`}
              className="block rounded-xl border border-ink-900/10 bg-white p-4 hover:border-ink-900/25 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.title || '(untitled)'}</div>
                  <div className="text-xs text-ink-700/60 truncate font-mono">/blog/{p.slug}</div>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    STATUS_BADGE[p.status] ?? 'bg-ink-900/5 text-ink-700'
                  }`}
                >
                  {p.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
