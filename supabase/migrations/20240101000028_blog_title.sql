-- ============================================================================
-- Optional per-client blog heading override.
--
-- The public blog index renders a hardcoded "The Blog" H1 for every client.
-- This nullable field lets the operator give a client's blog its own name
-- (e.g. "From The Tip Jar" for Pour Mobile Events) without touching anything
-- else. NULL → fall back to the default "The Blog". Edited from the admin
-- "Blog branding" panel, alongside business_display_name and the logo.
-- ============================================================================

alter table public.clients
  add column blog_title text;
