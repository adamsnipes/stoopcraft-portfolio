import { getPublishablePosts } from '@/lib/marketing-blog/posts';
import {
  BLOG_URL,
  BLOG_TITLE,
  BLOG_DESCRIPTION,
  postUrl,
} from '@/lib/marketing-blog/config';

// RSS 2.0 feed for the blog. Route handlers aren't auto-cached in this Next
// build, so we set Cache-Control explicitly (memory: cache-bust shared assets /
// route handlers need explicit headers). Reads the .mdoc files at request time.
export const dynamic = 'force-dynamic';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rfc822(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(Date.UTC(y, m - 1, d)).toUTCString();
}

export async function GET() {
  const posts = await getPublishablePosts();

  const items = posts
    .map((p) => {
      const url = postUrl(p.slug);
      const date = rfc822(p.updatedDate ?? p.publishedDate);
      return [
        '    <item>',
        `      <title>${esc(p.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        date ? `      <pubDate>${date}</pubDate>` : '',
        p.category ? `      <category>${esc(p.category.label)}</category>` : '',
        `      <description>${esc(p.description)}</description>`,
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(BLOG_TITLE)}</title>
    <link>${BLOG_URL}</link>
    <description>${esc(BLOG_DESCRIPTION)}</description>
    <language>en-us</language>
    <atom:link href="${BLOG_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
