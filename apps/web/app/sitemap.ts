import type { MetadataRoute } from 'next';
import { getPublishablePosts, getActiveCategories } from '@/lib/marketing-blog/posts';
import { postUrl, categoryUrl } from '@/lib/marketing-blog/config';

const SITE_URL = 'https://stoopcraft.com';

// The sitemap is generated from the actual content source (UNIVERSAL §27), so it
// stays in sync automatically as .mdoc files are added/removed — no manual URL
// list to maintain. Drafts are excluded (getPublishablePosts). Canonical and
// sitemap URLs are built from the same helpers as the pages (§26).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Scope: the landing page and what it links to — /, /blog (+ posts and
  // categories below), /terms, /privacy. Standalone campaign landing pages
  // (/landscapers, /ai, /marketing) and recruiting pages (/affiliates,
  // /sales-reps) are deliberately NOT listed: they're paid/direct-traffic
  // destinations, not organic search targets. They remain crawlable and each
  // carries its own canonical — they're just not promoted here.
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const [posts, categories] = await Promise.all([
    getPublishablePosts(),
    getActiveCategories(),
  ]);

  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: postUrl(p.slug),
    lastModified: p.updatedDate ?? p.publishedDate ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((c) => ({
    url: categoryUrl(c.slug),
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  return [...staticEntries, ...postEntries, ...categoryEntries];
}
