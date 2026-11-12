-- ============================================================================
-- Per-client "claim this site" banner suppression
--
-- Unclaimed (status='live') template sites are shown to prospects via their
-- tokenized preview link (slug.PLATFORM_DOMAIN/?t=<claim_token>). We render a
-- sticky top banner on those previews that links straight to the branded
-- checkout page (/pay/<client.id>) so the prospect can claim + pay in one click
-- instead of us copy-pasting the link to them. The banner disappears on its own
-- once the site is claimed (claimed sites render a different code path).
--
--   hide_claim_banner  -- opt-out for sites that should never show the banner
--                         even while unclaimed — chiefly demo/sample builds we
--                         keep live for the portfolio. Defaults false so every
--                         normal pre-sale preview gets the banner automatically.
-- ============================================================================

alter table public.clients
  add column hide_claim_banner boolean not null default false;
