import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  turbopack: {
    // Explicitly set workspace root to silence multi-lockfile warning in monorepo
    root: path.resolve(__dirname, '../..'),
  },

  // The blog reads its Markdoc source (content/blog/**/*.mdoc) from the
  // filesystem at request time via @keystatic/core/reader. Next's tracer
  // follows `import`s but can't see these dynamic `fs` reads, so on Vercel the
  // .mdoc files would be missing from the serverless bundle (ENOENT in prod).
  // We include them explicitly for every blog route + the sitemap.
  //
  // Values are resolved from the file-tracing root, which is ambiguous in this
  // monorepo (two lockfiles). We list BOTH candidate paths — the non-matching
  // one simply includes nothing — so the files ship whether the root resolves
  // to apps/web or the repo root.
  outputFileTracingIncludes: {
    '/blog': ['./content/blog/**/*', './apps/web/content/blog/**/*'],
    '/blog/**': ['./content/blog/**/*', './apps/web/content/blog/**/*'],
    '/sitemap.xml': ['./content/blog/**/*', './apps/web/content/blog/**/*'],
  },
};

export default nextConfig;
