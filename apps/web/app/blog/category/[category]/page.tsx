import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategory } from '@/lib/marketing-blog/categories';
import { getPostsByCategory } from '@/lib/marketing-blog/posts';
import { categoryUrl, SITE_URL, BLOG_URL } from '@/lib/marketing-blog/config';
import { breadcrumbLd } from '@/lib/marketing-blog/seo';
import { PostCard } from '../../_components/PostCard';
import { BlogMasthead } from '../../_components/Masthead';
import { JsonLd } from '../../_components/JsonLd';

type Params = Promise<{ category: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) return { title: 'Not found', robots: { index: false, follow: false } };
  return {
    title: `${cat.label} — StoopCraft Blog`,
    description: cat.description,
    alternates: { canonical: `/blog/category/${cat.slug}` },
    openGraph: {
      type: 'website',
      url: categoryUrl(cat.slug),
      title: `${cat.label} — StoopCraft Blog`,
      description: cat.description,
    },
  };
}

export default async function CategoryPage({ params }: { params: Params }) {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) notFound();

  const posts = await getPostsByCategory(cat.slug);
  // A category page with no posts is a thin/doorway page — don't publish it.
  if (posts.length === 0) notFound();

  return (
    <main className="min-h-screen bg-cream-50 text-ink-900">
      <BlogMasthead
        breadcrumbs={[
          { name: 'Home', href: '/' },
          { name: 'Blog', href: '/blog' },
          { name: cat.label },
        ]}
      >
        <h1 className="mt-5 font-display text-3xl font-semibold leading-tight sm:text-4xl">
          {cat.label}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-cream-100/85">
          {cat.description}
        </p>
      </BlogMasthead>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      </div>

      <JsonLd
        data={breadcrumbLd([
          { name: 'Home', url: `${SITE_URL}/` },
          { name: 'Blog', url: BLOG_URL },
          { name: cat.label, url: categoryUrl(cat.slug) },
        ])}
      />
    </main>
  );
}
