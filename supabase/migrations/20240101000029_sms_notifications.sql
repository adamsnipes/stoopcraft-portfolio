-- ============================================================================
-- Per-client lead-notification SMS (paid upsell)
--
-- Texts a client's website form submissions to their phone, in ADDITION to the
-- existing email notification (see app/api/contact + the notification_email
-- migration). This is a PAID UPSELL, gated per client:
--
--   sms_notifications_enabled  -- the gate: flip on ONLY when they buy the
--                                 add-on. Defaults false so no one is texted
--                                 (and no Twilio spend) until purchased.
--   notification_phone         -- where the text goes. Decoupled from the
--                                 business's public `phone` column on purpose:
--                                 the owner may display one number on the site
--                                 but want alerts at another (e.g. a cell).
--
-- Routing rule (see app/api/contact): SMS fires only when the gate is on AND a
-- notification_phone is set AND Twilio is configured. Email is unaffected and
-- remains the primary channel — SMS is a best-effort nudge on top.
-- ============================================================================

alter table public.clients
  add column notification_phone text,
  add column sms_notifications_enabled boolean not null default false;
