-- ============================================================================
-- Per-client sales brand
--
-- StoopCraft also sells under a second, independent brand (Stupid Cheap
-- Websites, $40/month). A client's brand decides every customer-facing touch
-- before and at activation: the preview claim banner, the /pay page and its
-- domain, the Stripe Checkout branding and price, the welcome page, and the
-- activation emails (sent through that brand's own Resend account).
--
--   brand  -- 'stoopcraft' (default; every existing client) or
--             'stupid-cheap-websites'. Set by the admin on the client's
--             billing tab.
-- ============================================================================

alter table public.clients
  add column brand text not null default 'stoopcraft'
  check (brand in ('stoopcraft', 'stupid-cheap-websites'));
