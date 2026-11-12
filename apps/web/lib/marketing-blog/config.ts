// Shared constants for the marketing blog. Kept in one place so routes, SEO
// builders, sitemap, and RSS agree on hostnames and paths (UNIVERSAL §26:
// canonical and sitemap must match on host/protocol/path/trailing-slash).

export const SITE_URL = 'https://stoopcraft.com';
export const BLOG_PATH = '/blog';
export const BLOG_URL = `${SITE_URL}${BLOG_PATH}`;

export const BLOG_TITLE = 'The StoopCraft Blog';
export const BLOG_DESCRIPTION =
  'Practical advice for local business owners on websites, local SEO, and turning online visitors into calls, quotes, and bookings — from the team at StoopCraft.';

export const ORG_NAME = 'StoopCraft';
export const ORG_LOGO = `${SITE_URL}/icon.png`;

// Public URL prefix for cover images. The Keystatic reader returns only the
// stored filename for an image field (publicPath is an admin-UI-only concern),
// so we prepend this ourselves when normalizing a post. Must match the
// `publicPath` set on the `cover` field in keystatic.config.ts.
export const COVER_PUBLIC_PATH = '/blog/covers/';

/** Turn a stored cover filename into a servable public path (or null). */
export const coverSrc = (filename: string | null | undefined): string | null =>
  filename ? `${COVER_PUBLIC_PATH}${filename}` : null;

/** Canonical + absolute URL helpers so every surface builds URLs identically. */
export const postUrl = (slug: string) => `${BLOG_URL}/${slug}`;
export const categoryUrl = (slug: string) => `${BLOG_URL}/category/${slug}`;
export const absolute = (path: string) =>
  path.startsWith('http') ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Format a 'yyyy-mm-dd' date as 'Month D, YYYY'. Parsed by hand rather than via
 * `new Date(str)` so it never shifts across a timezone boundary.
 */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
