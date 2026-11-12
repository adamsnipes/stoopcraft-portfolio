import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPost, getRelatedPosts } from '@/lib/marketing-blog/posts';
import { formatDate, postUrl, categoryUrl, SITE_URL, BLOG_URL } from '@/lib/marketing-blog/config';
import { blogPostingLd, breadcrumbLd, faqPageLd } from '@/lib/marketing-blog/seo';
import { extractHeadings } from '@/lib/marketing-blog/markdoc';
import { MarkdocContent } from '../_components/MarkdocContent';
import { TableOfContents } from '../_components/TableOfContents';
import { CtaBlock } from '../_components/CtaBlock';
import { RelatedPosts } from '../_components/RelatedPosts';
import { Breadcrumbs } from '../_components/Breadcrumbs';
import { JsonLd } from '../_components/JsonLd';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: 'Not found', robots: { index: false, follow: false } };

  const canonical = post.canonicalUrl ?? `/blog/${post.slug}`;
  const images = post.cover ? [{ url: post.cover, alt: post.coverAlt }] : undefined;

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      url: postUrl(post.slug),
      title: post.title,
      description: post.description,
      publishedTime: post.publishedDate,
      modifiedTime: post.updatedDate ?? post.publishedDate,
      authors: [post.author],
      section: post.category?.label,
      tags: post.tags,
      images,
    },
    twitter: {
      card: post.cover ? 'summary_large_image' : 'summary',
      title: post.title,
      description: post.description,
      images: post.cover ? [post.cover] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const related = await getRelatedPosts(post.slug, post.categorySlug, 3);

  // On-page TOC: body headings, plus the template-rendered FAQ section.
  const toc = extractHeadings(post.body);
  if (post.faqs.length > 0) {
    toc.push({ level: 2, text: 'Frequently asked questions', id: 'faq' });
  }

  const crumbs = [
    { name: 'Home', href: '/' },
    { name: 'Blog', href: '/blog' },
    ...(post.category ? [{ name: post.category.label, href: categoryUrl(post.category.slug) }] : []),
    { name: post.title },
  ];

  const ldCrumbs = [
    { name: 'Home', url: `${SITE_URL}/` },
    { name: 'Blog', url: BLOG_URL },
    ...(post.category ? [{ name: post.category.label, url: categoryUrl(post.category.slug) }] : []),
    { name: post.title, url: postUrl(post.slug) },
  ];

  return (
    <main className="min-h-screen bg-cream-50 text-ink-900">
      <article>
        {/* Header */}
        <header className="mx-auto max-w-3xl px-6 pt-12 sm:pt-16">
          <Breadcrumbs items={crumbs} />
          {post.category && (
            <a
              href={categoryUrl(post.category.slug)}
              className="mt-6 inline-block text-xs font-semibold uppercase tracking-wider text-amber-accent hover:underline"
            >
              {post.category.label}
            </a>
          )}
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink-900 sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-700">{post.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-700/75">
            <span>{post.author}</span>
            <span aria-hidden className="text-ink-700/30">·</span>
            <time dateTime={post.publishedDate}>{formatDate(post.publishedDate)}</time>
            {post.updatedDate && post.updatedDate !== post.publishedDate && (
              <>
                <span aria-hidden className="text-ink-700/30">·</span>
                <span>Updated {formatDate(post.updatedDate)}</span>
              </>
            )}
          </div>
        </header>

        {/* Cover */}
        {post.cover && (
          <figure className="mx-auto mt-8 max-w-4xl px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.cover}
              alt={post.coverAlt}
              // This cover is the LCP element — tell the browser to prioritize it.
              fetchPriority="high"
              width={1600}
              height={900}
              className="aspect-[16/9] w-full rounded-2xl object-cover"
            />
            {post.coverCredit && (
              <figcaption className="mt-2 text-center text-xs text-ink-700/55">
                {post.coverCredit}
              </figcaption>
            )}
          </figure>
        )}

        {/* Body */}
        <div className="mx-auto mt-10 max-w-3xl px-6">
          <TableOfContents items={toc} />
          <MarkdocContent node={post.body} />

          {/* FAQ (also emitted as FAQPage structured data) */}
          {post.faqs.length > 0 && (
            <section className="mt-14 border-t border-ink-900/10 pt-10">
              <h2 id="faq" className="scroll-mt-20 font-display text-2xl font-semibold text-ink-900">
                Frequently asked questions
              </h2>
              <dl className="mt-6 space-y-6">
                {post.faqs.map((f, i) => (
                  <div key={i}>
                    <dt className="font-display text-base font-semibold text-ink-900">{f.question}</dt>
                    <dd className="mt-2 text-[0.95rem] leading-relaxed text-ink-700">{f.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* Product bridge — closes every post */}
          <CtaBlock />
        </div>
      </article>

      <RelatedPosts posts={related} />

      <div className="h-16" />

      <JsonLd
        data={[
          blogPostingLd(post),
          breadcrumbLd(ldCrumbs),
          faqPageLd(post.faqs),
        ]}
      />
    </main>
  );
}
