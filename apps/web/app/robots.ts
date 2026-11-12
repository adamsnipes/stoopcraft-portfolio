import type { MetadataRoute } from 'next';

const SITE_URL = 'https://stoopcraft.com';

// Customer-served sites already get an `X-Robots-Tag: noindex, nofollow`
// header from the proxy, so they're excluded from indexing regardless of
// what we say here. This file only governs the platform apex.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/portal/', '/reps/', '/onboarding/', '/checkout/', '/auth/', '/claim/', '/s/', '/login'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
