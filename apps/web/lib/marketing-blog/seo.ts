import type { PostMeta, PostFaq } from './posts';
import {
  SITE_URL,
  BLOG_URL,
  BLOG_TITLE,
  BLOG_DESCRIPTION,
  ORG_NAME,
  ORG_LOGO,
  postUrl,
  absolute,
} from './config';

// ============================================================================
// JSON-LD structured-data builders (UNIVERSAL §28). Each returns a plain object
// serialized into an inline <script type="application/ld+json" nonce> in the
// route — matching the pattern already used in app/layout.tsx. No fabricated
// values: everything is derived from the post's own frontmatter.
// ============================================================================

type Json = Record<string, unknown>;

const publisher: Json = {
  '@type': 'Organization',
  name: ORG_NAME,
  logo: { '@type': 'ImageObject', url: ORG_LOGO },
};

/** BlogPosting for an individual article. */
export function blogPostingLd(post: PostMeta): Json {
  const url = postUrl(post.slug);
  const ld: Json = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: post.publishedDate,
    dateModified: post.updatedDate ?? post.publishedDate,
    author: { '@type': 'Organization', name: post.author, url: SITE_URL },
    publisher,
  };
  if (post.cover) ld.image = [absolute(post.cover)];
  if (post.category) ld.articleSection = post.category.label;
  if (post.tags.length) ld.keywords = post.tags.join(', ');
  return ld;
}

/** BreadcrumbList from an ordered list of {name, url} crumbs. */
export function breadcrumbLd(items: { name: string; url: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** FAQPage — only emit when the post actually has real Q&A (UNIVERSAL §28). */
export function faqPageLd(faqs: PostFaq[]): Json | null {
  if (!faqs.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

/** Blog collection page (the /blog index). */
export function blogCollectionLd(posts: PostMeta[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    url: BLOG_URL,
    publisher,
    blogPost: posts.slice(0, 20).map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: postUrl(p.slug),
      datePublished: p.publishedDate,
    })),
  };
}
