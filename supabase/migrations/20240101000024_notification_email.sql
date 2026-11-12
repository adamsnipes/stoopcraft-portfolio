-- ============================================================================
-- Per-client lead-notification email
--
-- Where a client's website form submissions (contact/lead/calculator) are
-- emailed. Deliberately DECOUPLED from the portal account: a client may sign
-- up / pay at Stripe with one address but want leads delivered to another
-- (e.g. claims with developer@example.com, wants leads at info@business.com).
--
-- Routing rule (see app/api/contact): notification_email WHEN SET wins;
-- otherwise fall back to the owner's account email. Because it doesn't depend
-- on owner_user_id, the operator can set it from the admin client page BEFORE
-- payment — so a prospect can watch their forms deliver real leads while still
-- evaluating (a conversion lever for the inbound / static-site motion).
-- ============================================================================

alter table public.clients
  add column notification_email text;
