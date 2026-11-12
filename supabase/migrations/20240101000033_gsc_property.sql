-- ============================================================================
-- Google Search Console property mapping
--
-- Every client property is added to ONE agency Google account, which is a
-- verified Owner on each of them. A GCP service account is then added as a
-- Full user on every property, so the platform reads Search Analytics for all
-- clients with a single server-side credential — no per-client OAuth consent
-- and no refresh tokens to expire (OAuth apps left in "Testing" status expire
-- refresh tokens after 7 days, which would silently kill the reports).
--
-- gsc_property stores the property ID exactly as the API's sites.list returns
-- it, which is one of two non-interchangeable forms:
--   sc-domain:example.com   (Domain property — all subdomains + schemes)
--   https://example.com/    (URL-prefix property — trailing slash significant)
-- Stored verbatim rather than derived from custom_domain because only the
-- exact string works as the API path segment. NULL = not connected, and the
-- SEO report is skipped for that client.
-- ============================================================================

alter table public.clients
  add column gsc_property text;
