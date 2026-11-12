import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllPosts, getActiveCategories } from '@/lib/marketing-blog/posts';
import { BLOG_TITLE, BLOG_DESCRIPTION, BLOG_URL, categoryUrl } from '@/lib/marketing-blog/config';
import { blogCollectionLd, breadcrumbLd } from '@/lib/marketing-blog/seo';
import { PostCard } from './_components/PostCard';
import { BlogMasthead } from './_components/Masthead';
import { JsonLd } from './_components/JsonLd';

export const metadata: Metadata = {
  title: BLOG_TITLE,
  description: BLOG_DESCRIPTION,
  alternates: {
    canonical: '/blog',
    types: { 'application/rss+xml': `${BLOG_URL}/rss.xml` },
  },
  openGraph: {
    type: 'website',
    url: BLOG_URL,
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
  },
};

export default async function BlogIndexPage() {
  const [posts, categories] = await Promise.all([getAllPosts(), getActiveCategories()]);
  const [lead, ...rest] = posts;

  return (
    <main className="min-h-screen bg-cream-50 text-ink-900">
      {/* Masthead — golden-hour main street behind a dark scrim */}
      <BlogMasthead breadcrumbs={[{ name: 'Home', href: '/' }, { name: 'Blog' }]}>
        <h1 className="mt-5 font-display text-4xl font-semibold leading-tight sm:text-5xl">
          {BLOG_TITLE}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-cream-100/85">
          {BLOG_DESCRIPTION}
        </p>
        {categories.length > 0 && (
          <div className="mt-7 flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={categoryUrl(c.slug)}
                className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-cream-100/85 transition-colors hover:border-amber-accent-soft hover:text-white"
              >
                {c.label}
              </Link>
            ))}
          </div>
        )}
      </BlogMasthead>

      <div className="mx-auto max-w-6xl px-6 py-14">
        {posts.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {lead && (
              <Link
                href={`/blog/${lead.slug}`}
                className="group mb-14 grid gap-6 overflow-hidden rounded-3xl border border-ink-900/10 bg-white md:grid-cols-2"
              >
                <div className="aspect-[16/10] w-full overflow-hidden bg-cream-100 md:aspect-auto">
                  {lead.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={lead.cover}
                      alt={lead.coverAlt}
                      fetchPriority="high"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full min-h-56 w-full items-center justify-center bg-gradient-to-br from-ink-900 to-ink-700">
                      <span className="font-display text-2xl font-semibold text-cream-50/90">StoopCraft</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-center p-7 sm:p-9">
                  {lead.category && (
                    <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-accent">
                      {lead.category.label}
                    </span>
                  )}
                  <h2 className="font-display text-2xl font-semibold leading-tight text-ink-900 group-hover:text-amber-accent sm:text-3xl">
                    {lead.title}
                  </h2>
                  <p className="mt-3 text-base leading-relaxed text-ink-700">{lead.description}</p>
                </div>
              </Link>
            )}

            {rest.length > 0 && (
              <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((p) => (
                  <PostCard key={p.slug} post={p} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <JsonLd
        data={[
          blogCollectionLd(posts),
          breadcrumbLd([
            { name: 'Home', url: 'https://stoopcraft.com/' },
            { name: 'Blog', url: BLOG_URL },
          ]),
        ]}
      />
    </main>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-dashed border-ink-900/15 bg-white px-8 py-16 text-center">
      <h2 className="font-display text-xl font-semibold text-ink-900">New articles are on the way</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-700">
        We&apos;re putting together practical guides on websites, local SEO, and turning visitors
        into customers. Check back soon.
      </p>
      <Link
        href="/#apply"
        className="mt-6 inline-flex rounded-full bg-amber-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8]"
      >
        See what StoopCraft can build for you
      </Link>
    </div>
  );
}
