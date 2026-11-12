// ---------------------------------------------------------------------------
// Customer-facing label for a client.
//
// Used wherever we address the customer about "their site" — transactional
// emails and lead SMS. Prefers a real business name, but MANY clients (every
// uploaded static site, as of this writing 47/49) were created with
// `business_name` set to their slug, which reads terribly to a customer
// ("We were unable to process your payment for pour-mobile-events").
//
// When the stored name is really just a slug, fall back to the site's own URL —
// reliable data the customer instantly recognizes as theirs — instead of
// guessing a display name. If they ever set a real business_name, it wins
// automatically with no further changes here.
// ---------------------------------------------------------------------------

import { clientSubdomainHost } from '@/lib/marketing-brand';

type ClientLike = {
  business_name: string | null;
  slug: string;
  custom_domain: string | null;
  brand?: string | null;
};

// A stored name "is really a slug" if it's byte-identical to the slug, or looks
// like one: all lowercase/digits, hyphen-separated, no spaces. A genuine display
// name almost always has a space or a capital letter, so this is conservative.
function isSlugLike(name: string, slug: string): boolean {
  if (name === slug) return true;
  return /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(name);
}

export function clientDisplayName(c: ClientLike): string {
  const name = (c.business_name ?? '').trim();
  if (name && !isSlugLike(name, c.slug)) return name;

  // No usable name — use the site's URL. A custom domain if attached, otherwise
  // the subdomain the site is served at.
  if (c.custom_domain) return c.custom_domain;
  return clientSubdomainHost(c);
}
