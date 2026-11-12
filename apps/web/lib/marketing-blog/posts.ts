import { cache } from 'react';
import type { Node as MarkdocNode } from '@markdoc/markdoc';
import { reader } from './reader';
import { getCategory, type BlogCategory } from './categories';
import { coverSrc } from './config';

// ============================================================================
// Post data layer — normalizes raw Keystatic reader entries into a stable
// PostMeta shape the routes/SEO/sitemap consume. All reads are wrapped in
// React `cache()` so a single request (page + generateMetadata + JSON-LD) hits
// the filesystem once.
//
// Draft handling: drafts are excluded everywhere in production. In development
// they remain visible so posts can be previewed before publishing.
// ============================================================================

const INCLUDE_DRAFTS = process.env.NODE_ENV !== 'production';

export type PostFaq = { question: string; answer: string };

export type PostMeta = {
  /** URL slug = content/blog/<slug>/. The path is /blog/<slug>. */
  slug: string;
  title: string;
  description: string;
  /** 'yyyy-mm-dd' */
  publishedDate: string;
  updatedDate: string | null;
  author: string;
  categorySlug: string;
  category: BlogCategory | null;
  tags: string[];
  /** Public path e.g. /blog/covers/foo.jpg, or null. */
  cover: string | null;
  coverAlt: string;
  coverCredit: string | null;
  featured: boolean;
  draft: boolean;
  /** Absolute canonical override, or null to self-canonicalize. */
  canonicalUrl: string | null;
  faqs: PostFaq[];
};

/** Full post = metadata + the lazily-resolved Markdoc AST for the body. */
export type PostFull = PostMeta & { body: MarkdocNode };

// Raw entry shape from the reader (content is a lazy async thunk).
type RawEntry = Awaited<ReturnType<typeof reader.collections.posts.read>>;

function normalize(slug: string, entry: NonNullable<RawEntry>): PostMeta {
  const categorySlug = entry.category;
  return {
    slug,
    title: entry.title,
    description: entry.description,
    publishedDate: entry.publishedDate ?? '',
    updatedDate: entry.updatedDate ?? null,
    author: entry.author || 'The StoopCraft Team',
    categorySlug,
    category: getCategory(categorySlug) ?? null,
    tags: [...entry.tags],
    // The reader returns just the stored filename; build the public URL.
    cover: coverSrc(entry.cover),
    coverAlt: entry.coverAlt || '',
    coverCredit: entry.coverCredit || null,
    featured: entry.featured,
    draft: entry.draft,
    canonicalUrl: entry.canonicalUrl ?? null,
    faqs: entry.faqs.map((f) => ({ question: f.question, answer: f.answer })),
  };
}

/** Newest first, then featured floated to the top. */
function sortForIndex(a: PostMeta, b: PostMeta): number {
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  return b.publishedDate.localeCompare(a.publishedDate);
}

/** All visible posts (drafts excluded in prod), sorted for the index. */
export const getAllPosts = cache(async (): Promise<PostMeta[]> => {
  const entries = await reader.collections.posts.all();
  const posts = entries
    .map(({ slug, entry }) => normalize(slug, entry as NonNullable<RawEntry>))
    .filter((p) => INCLUDE_DRAFTS || !p.draft);
  posts.sort(sortForIndex);
  return posts;
});

/** Slugs of all publishable posts — used by sitemap.ts. */
export const getPublishablePosts = cache(async (): Promise<PostMeta[]> => {
  const posts = await getAllPosts();
  // Drafts are never publishable regardless of environment.
  return posts.filter((p) => !p.draft);
});

/** One post with its resolved Markdoc body, or null (incl. draft-in-prod). */
export const getPost = cache(async (slug: string): Promise<PostFull | null> => {
  const entry = await reader.collections.posts.read(slug);
  if (!entry) return null;
  const meta = normalize(slug, entry);
  if (meta.draft && !INCLUDE_DRAFTS) return null;
  const { node } = await entry.content();
  return { ...meta, body: node };
});

/** Posts in a category (visible only), sorted for the index. */
export const getPostsByCategory = cache(async (categorySlug: string): Promise<PostMeta[]> => {
  const posts = await getAllPosts();
  return posts.filter((p) => p.categorySlug === categorySlug);
});

/**
 * Related posts for the "Related reading" module (UNIVERSAL §21) + orphan
 * prevention (§20). Same category first, then backfilled with the newest other
 * posts so a post is never orphaned even in a thin category. Never returns the
 * post itself or drafts.
 */
export const getRelatedPosts = cache(
  async (slug: string, categorySlug: string, limit = 3): Promise<PostMeta[]> => {
    const posts = (await getAllPosts()).filter((p) => p.slug !== slug && !p.draft);
    const sameCategory = posts.filter((p) => p.categorySlug === categorySlug);
    const rest = posts.filter((p) => p.categorySlug !== categorySlug);
    return [...sameCategory, ...rest].slice(0, limit);
  }
);

/** Categories that currently have at least one visible post. */
export const getActiveCategories = cache(async (): Promise<BlogCategory[]> => {
  const posts = await getAllPosts();
  const slugs = new Set(posts.filter((p) => !p.draft).map((p) => p.categorySlug));
  const out: BlogCategory[] = [];
  for (const p of posts) {
    if (p.category && slugs.has(p.category.slug) && !out.some((c) => c.slug === p.category!.slug)) {
      out.push(p.category);
    }
  }
  return out;
});
