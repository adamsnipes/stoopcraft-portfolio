-- ============================================================================
-- Optional display-name override.
--
-- business_name stays the canonical value that emails, template rendering, and
-- admin tooling depend on — editing it could ripple through all of those. This
-- separate, nullable field is what gets SHOWN on customer-facing surfaces (the
-- blog masthead today) so the operator can present a clean name (e.g. "Pour
-- Mobile Events") without touching business_name. NULL → fall back to
-- business_name.
-- ============================================================================

alter table public.clients
  add column business_display_name text;
