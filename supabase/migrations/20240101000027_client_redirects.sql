-- ============================================================================
-- Per-client redirect map (for the WordPress → static-site cutover).
--
-- When a multi-page WP site collapses into a single-page static site, old deep
-- URLs (/services, /about, /blog/old-post, …) would 404 and waste the backlinks
-- they've earned. This stores operator-defined 301s as an array of
-- {from, to} objects; the static-serve route checks it before returning 404 and
-- issues a 301, preserving link equity. Empty by default.
-- ============================================================================

alter table public.clients
  add column redirects jsonb not null default '[]'::jsonb;
