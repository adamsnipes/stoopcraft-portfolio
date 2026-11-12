import sanitizeHtml from 'sanitize-html';

// ============================================================================
// Sanitize post HTML on save. The editor (TipTap) is client-side and produces
// HTML we cannot trust — this is the security boundary. Allow only a safe
// formatting subset; strip scripts, styles, iframes, event handlers, and any
// non-http(s)/mailto links. Stored HTML is then rendered as-is by the public
// blog (lib/blog/render.ts) under a script-src 'none' CSP as a second layer.
//
// Links are split into two classes (see linkTransform below):
//   external → rel="noopener noreferrer nofollow ugc" target="_blank"
//   internal → left to navigate normally, and NOT nofollowed
// Internal links are how a blog post passes signal to the client's own service
// pages. Blanket-nofollowing them severs that (UNIVERSAL_BLOG_GUIDELINES §19).
// ============================================================================

const ALLOWED_TAGS = [
  'p', 'br', 'hr', 'blockquote', 'pre', 'code',
  'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u', 's',
  'a', 'img',
];

/** Strip a leading "www." so example.com and www.example.com compare equal. */
function bareHost(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, '');
}

/**
 * Is this href the client's own site?
 *
 * True for relative URLs ("/", "/blog/x", "#faq", "./x") — those can only ever
 * resolve to the site the post is served from, so they're internal by
 * construction. Also true for an absolute http(s) URL whose host matches
 * `siteHost`, which is how links arrive when an author pastes a full URL.
 *
 * Deliberately false for protocol-relative "//evil.com" — that is external.
 */
function isInternalHref(href: string, siteHost?: string): boolean {
  const h = href.trim();
  if (!h) return false;

  // Relative forms. "//" is protocol-relative and therefore NOT relative.
  if (h.startsWith('#')) return true;
  if (h.startsWith('./') || h.startsWith('../')) return true;
  if (h.startsWith('/') && !h.startsWith('//')) return true;

  if (!siteHost) return false;

  // Absolute: compare hosts. An unparseable URL is treated as external.
  try {
    const url = new URL(h);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return bareHost(url.hostname) === bareHost(siteHost);
  } catch {
    return false;
  }
}

function linkTransform(siteHost?: string): sanitizeHtml.Transformer {
  return (tagName, attribs) => {
    const href = attribs.href ?? '';

    if (isInternalHref(href, siteHost)) {
      // Same site: navigate in place, keep the link followable. Drop any
      // target/rel the editor may have added so a pasted external-style link
      // can't smuggle nofollow onto an internal destination.
      const { target: _target, rel: _rel, ...rest } = attribs;
      return { tagName, attribs: rest };
    }

    return {
      tagName,
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer nofollow ugc',
        target: '_blank',
      },
    };
  };
}

function options(siteHost?: string): sanitizeHtml.IOptions {
  return {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    transformTags: { a: linkTransform(siteHost) },
    // Drop empty class/style noise entirely.
    allowedClasses: {},
  };
}

/**
 * Sanitize post body HTML for storage.
 *
 * @param dirty    Untrusted HTML from the editor.
 * @param siteHost The client's own hostname (custom domain or platform
 *                 subdomain). Optional: without it, relative links are still
 *                 treated as internal, but absolute self-links are not
 *                 recognized and get nofollowed like any external link.
 */
export function sanitizePostHtml(dirty: string, siteHost?: string): string {
  return sanitizeHtml(dirty ?? '', options(siteHost));
}

/** URL-safe slug from a title. Always returns a non-empty value. */
export function slugify(input: string): string {
  const s = (input ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return s || 'post';
}
