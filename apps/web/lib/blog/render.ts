import { createServiceRoleClient } from '@/lib/supabase/server';
import { clientSubdomainHost } from '@/lib/marketing-brand';
import type { PostRow } from '@dfy/db';
import { listPublishedPosts, getPublishedPost } from './posts';
import { findRedirect } from '@/lib/static-sites/redirects';

// ============================================================================
// Public blog rendering for a client's site. Server-rendered HTML (so it's
// SEO-clean), returned with CDN cache headers so it's static-fast. Everything
// is scoped by clientId — a request to one client's /blog can only ever read
// that client's posts (see lib/blog/posts.ts). The post body is pre-sanitized
// HTML (sanitize-html at save time, in the admin editor); titles/excerpts are
// escaped here.
// ============================================================================

// Cache at the CDN: fresh for a minute, then serve stale instantly while
// revalidating for a day. A published post propagates within ~60s; misses are
// a cheap DB query. (On-demand purge can be layered on later for instant
// publish — see project_blog_feature_plan.)
const CACHE = 'public, s-maxage=60, stale-while-revalidate=86400';

type BlogClient = {
  id: string;
  business_name: string;
  blog_title: string | null;
  slug: string;
  custom_domain: string | null;
  logo_url: string | null;
  brand: string | null;
};

async function getBlogClient(clientId: string): Promise<BlogClient | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from('clients')
    .select('id, business_name, business_display_name, blog_title, slug, custom_domain, logo_url, brand')
    .eq('id', clientId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    // Prefer the operator-set display name; fall back to the canonical name.
    business_name: data.business_display_name || data.business_name,
    blog_title: data.blog_title,
    slug: data.slug,
    custom_domain: data.custom_domain,
    logo_url: data.logo_url,
    brand: data.brand,
  };
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Public base URL of this client's site — custom domain preferred, temp slug otherwise. */
function siteBase(client: BlogClient): string {
  return client.custom_domain
    ? `https://${client.custom_domain}`
    : `https://${clientSubdomainHost(client)}`;
}

const STYLE = `
  :root{--ink:#1a2236;--muted:#6b7384;--line:#ece8e0;--accent:#1c3461;--bg:#faf8f4}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.7;-webkit-font-smoothing:antialiased}
  a{color:var(--accent);text-decoration:none}
  .wrap{max-width:780px;margin:0 auto;padding:0 24px}
  /* The index runs a 3-up card grid and needs the room; the article stays at
     the reading measure above. */
  .wrap.wide{max-width:1200px}

  header.mast{border-bottom:1px solid var(--line);background:rgba(255,255,255,.86);backdrop-filter:blur(8px);position:sticky;top:0;z-index:10}
  header.mast .inner{display:flex;align-items:center;justify-content:space-between;height:80px}
  header.mast .brand{display:flex;align-items:center;gap:13px}
  header.mast img{height:52px;width:auto;display:block}
  header.mast .name{font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:1.55rem;color:var(--accent);letter-spacing:-.01em}
  header.mast .home-link{font-size:.84rem;color:var(--muted)}
  header.mast .home-link:hover{color:var(--accent)}

  main{padding:66px 0 76px}
  .page-head{text-align:center;max-width:600px;margin:0 auto 56px}
  .eyebrow{display:inline-block;font-size:.74rem;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin-bottom:15px}
  .page-head h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:3.1rem;line-height:1.04;margin:0 0 14px;letter-spacing:-.01em}
  .page-head .sub{color:var(--muted);font-size:1.08rem;margin:0}

  .post-list{list-style:none;margin:0;padding:0;display:grid;gap:28px;grid-template-columns:repeat(3,minmax(0,1fr))}
  /* A short list shouldn't strand empty columns or stretch two cards into
     billboards — narrow the track set to the post count instead. */
  .post-list.count-1{grid-template-columns:minmax(0,430px);justify-content:center}
  .post-list.count-2{grid-template-columns:repeat(2,minmax(0,1fr));max-width:830px;margin:0 auto}
  .post-list li{display:flex}
  .card{display:flex;flex-direction:column;width:100%;color:inherit;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#fff;transition:box-shadow .25s,transform .25s,border-color .25s}
  .card:hover{box-shadow:0 18px 44px rgba(20,30,60,.10);transform:translateY(-3px);border-color:#dfd9cd}
  .card .cover{height:200px;flex:none;background-size:cover;background-position:center;background-color:#eceae3}
  .card .body{padding:22px 24px 24px;flex:1}
  .card .date{color:var(--accent);font-size:.76rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;margin:0 0 9px}
  .card h2{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;margin:0 0 8px;font-size:1.5rem;line-height:1.16;color:var(--ink)}
  .card p{margin:0;color:var(--muted);font-size:.96rem}

  .empty{text-align:center;padding:52px 24px 58px;border:1px dashed #ddd6c8;border-radius:18px;background:#fff;max-width:540px;margin:0 auto}
  .empty .ico{width:62px;height:62px;border-radius:16px;background:rgba(28,52,97,.07);color:var(--accent);display:flex;align-items:center;justify-content:center;margin:0 auto 18px}
  .empty h3{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:1.7rem;margin:0 0 6px;color:var(--ink)}
  .empty p{color:var(--muted);margin:0}

  article{max-width:700px;margin:0 auto}
  .back{display:inline-block;margin-bottom:30px;color:var(--muted);font-size:.88rem}
  .back:hover{color:var(--accent)}
  article .date{color:var(--accent);font-size:.78rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin:0 0 12px}
  article h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:2.9rem;line-height:1.07;letter-spacing:-.01em;margin:0 0 18px}
  article .cover{height:390px;background-size:cover;background-position:center;border-radius:18px;margin:10px 0 40px;background-color:#eceae3}
  article .content{font-size:1.1rem;color:#283047}
  article .content img{max-width:100%;height:auto;border-radius:12px;margin:8px 0}
  article .content h2{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:1.95rem;margin:38px 0 12px;color:var(--ink)}
  article .content h3{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:1.5rem;margin:30px 0 10px;color:var(--ink)}
  article .content p{margin:0 0 20px}
  article .content ul,article .content ol{margin:0 0 20px;padding-left:22px}
  article .content li{margin:0 0 8px}
  article .content a{color:var(--accent);text-decoration:underline}
  article .content blockquote{margin:26px 0;padding:8px 24px;border-left:3px solid var(--accent);font-family:'Cormorant Garamond',Georgia,serif;font-size:1.4rem;font-style:italic;color:var(--ink)}

  footer{border-top:1px solid var(--line);padding:34px 0;color:var(--muted);font-size:.85rem;text-align:center;background:#fff}
  footer a{color:var(--muted)}
  footer a:hover{color:var(--accent)}

  /* 3 -> 2 -> 1 column. The count-N selectors are repeated here because they
     out-specify a bare .post-list rule and would otherwise win at every width. */
  @media(max-width:1000px){.post-list,.post-list.count-2{grid-template-columns:repeat(2,minmax(0,1fr));max-width:none}}
  @media(max-width:680px){.post-list,.post-list.count-1,.post-list.count-2{grid-template-columns:minmax(0,1fr);max-width:none;justify-content:stretch}}
  @media(max-width:560px){.page-head h1{font-size:2.5rem}article h1{font-size:2.1rem}.card .cover{height:180px}article .cover{height:240px}header.mast .home-link{display:none}}
`;

function shell(opts: {
  title: string;
  description: string;
  canonical: string;
  noindex: boolean;
  client: BlogClient;
  head?: string;
  body: string;
  /** Extra class on every .wrap — 'wide' widens the index for the card grid. */
  wrapMod?: string;
}): string {
  const { title, description, canonical, noindex, client, head = '', body, wrapMod = '' } = opts;
  const wrap = wrapMod ? `wrap ${wrapMod}` : 'wrap';
  const home = siteBase(client);
  const mastLogo = client.logo_url
    ? `<img src="${esc(client.logo_url)}" alt="${esc(client.business_name)}" />`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(canonical)}" />
${noindex ? '<meta name="robots" content="noindex, nofollow" />' : '<meta name="robots" content="index, follow" />'}
<meta property="og:type" content="website" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(canonical)}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
${head}
<style>${STYLE}</style>
</head>
<body>
<header class="mast"><div class="${wrap} inner"><a class="brand" href="${esc(home)}">${mastLogo}<span class="name">${esc(client.business_name)}</span></a><a class="home-link" href="${esc(home)}">Visit our site &rarr;</a></div></header>
<main><div class="${wrap}">${body}</div></main>
<footer><div class="${wrap}">&copy; ${new Date().getFullYear()} ${esc(client.business_name)} &middot; <a href="${esc(home)}">${esc(client.custom_domain ?? client.business_name)}</a></div></footer>
</body>
</html>`;
}

function renderIndex(client: BlogClient, posts: PostRow[], noindex: boolean): string {
  const base = siteBase(client);
  // count-1 / count-2 narrow the grid so a short list doesn't leave a hole in
  // the row; 3 or more fill all three columns.
  const countMod = posts.length < 3 ? ` count-${posts.length}` : '';
  const items = posts.length
    ? `<ul class="post-list${countMod}">${posts
        .map((p) => {
          const cover = p.cover_image_url
            ? `<div class="cover" style="background-image:url('${esc(p.cover_image_url)}')"></div>`
            : '';
          const excerpt = p.excerpt ? `<p>${esc(p.excerpt)}</p>` : '';
          return `<li><a class="card" href="${esc(base)}/blog/${esc(p.slug)}">${cover}<div class="body"><div class="date">${esc(fmtDate(p.published_at))}</div><h2>${esc(p.title)}</h2>${excerpt}</div></a></li>`;
        })
        .join('')}</ul>`
    : `<div class="empty"><div class="ico"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div><h3>Fresh stories on the way</h3><p>We're putting together our first posts — check back soon.</p></div>`;

  // Operator-set blog name (e.g. "From The Tip Jar"); default to "The Blog".
  const blogTitle = client.blog_title?.trim() || 'The Blog';
  const pageHead = `<div class="page-head"><span class="eyebrow">Insights &amp; Updates</span><h1>${esc(blogTitle)}</h1><p class="sub">Stories, tips, and news from ${esc(client.business_name)}.</p></div>`;

  return shell({
    title: `${blogTitle} — ${client.business_name}`,
    description: `Stories, tips, and updates from ${client.business_name}.`,
    canonical: `${base}/blog`,
    noindex,
    client,
    wrapMod: 'wide',
    body: `${pageHead}${items}`,
  });
}

function renderPost(client: BlogClient, post: PostRow, noindex: boolean): string {
  const base = siteBase(client);
  const canonical = `${base}/blog/${post.slug}`;
  const description = post.seo_description || post.excerpt || `${post.title} — ${client.business_name}`;
  const cover = post.cover_image_url
    ? `<div class="cover" style="background-image:url('${esc(post.cover_image_url)}')"></div>`
    : '';

  // BlogPosting structured data for rich results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: { '@type': 'Organization', name: client.business_name },
    publisher: { '@type': 'Organization', name: client.business_name },
    mainEntityOfPage: canonical,
    ...(post.cover_image_url ? { image: post.cover_image_url } : {}),
    ...(description ? { description } : {}),
  };
  const head = `<meta property="og:type" content="article" />${
    post.cover_image_url ? `<meta property="og:image" content="${esc(post.cover_image_url)}" />` : ''
  }<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`;

  return shell({
    title: post.seo_title || `${post.title} — ${client.business_name}`,
    description,
    canonical,
    noindex,
    client,
    head,
    // body_html is pre-sanitized at save time; rendered as-is.
    body: `<a class="back" href="${esc(base)}/blog">&larr; All posts</a><article><div class="date">${esc(fmtDate(post.published_at))}</div><h1>${esc(post.title)}</h1>${cover}<div class="content">${post.body_html}</div></article>`,
  });
}

function htmlResponse(html: string, noindex: boolean): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': CACHE,
    'X-Content-Type-Options': 'nosniff',
    // No scripts needed on a content page → lock it down. Images allow https
    // for covers; styles are inline.
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data: https:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; script-src 'none'; base-uri 'none'; frame-ancestors 'self'",
  };
  if (noindex) headers['X-Robots-Tag'] = 'noindex, nofollow';
  return new Response(html, { status: 200, headers });
}

function renderSitemap(client: BlogClient, posts: PostRow[]): string {
  const base = siteBase(client);
  const url = (loc: string, lastmod?: string | null) =>
    `<url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''}</url>`;
  const entries = [
    url(`${base}/blog`),
    ...posts.map((p) => url(`${base}/blog/${p.slug}`, p.updated_at)),
  ].join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

/**
 * Serve a client's public blog. `segments` is the path after `/blog`
 * (e.g. [] for the index, ['my-post'] for a post). Scoped entirely to
 * `clientId`. `status` gates indexability: only 'claimed' is indexable.
 */
export async function serveBlog(
  clientId: string,
  status: 'claimed' | 'live',
  segments: string[],
): Promise<Response> {
  const client = await getBlogClient(clientId);
  if (!client) return new Response('Not found', { status: 404 });

  const noindex = status !== 'claimed';

  if (segments.length === 1 && segments[0] === 'sitemap.xml') {
    const posts = await listPublishedPosts(clientId);
    return new Response(renderSitemap(client, posts), {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': CACHE },
    });
  }

  if (segments.length === 0) {
    const posts = await listPublishedPosts(clientId);
    return htmlResponse(renderIndex(client, posts, noindex), noindex);
  }

  if (segments.length === 1) {
    const post = await getPublishedPost(clientId, segments[0]!);
    if (post) return htmlResponse(renderPost(client, post, noindex), noindex);
  }

  // Nothing matched under /blog — honor an operator 301 (e.g. an old WP post
  // URL) before 404ing, to preserve backlinks across the migration.
  const to = await findRedirect(clientId, `/blog/${segments.join('/')}`);
  if (to) {
    return new Response(null, { status: 301, headers: { Location: to, 'Cache-Control': 'public, max-age=3600' } });
  }
  return new Response('Not found', { status: 404 });
}
