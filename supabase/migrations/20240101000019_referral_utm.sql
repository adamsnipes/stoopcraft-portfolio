-- ============================================================================
-- Per-channel attribution for affiliate links. /r/<code>?utm_source=twitter
-- drops a cookie alongside the existing sc_ref cookie; the pipeline reads
-- both at row-creation and stamps the source onto the client. Lets affiliates
-- see "Twitter brought me 5 conversions, YouTube brought me 1" in their
-- dashboard without us having to JOIN events ↔ clients heuristically.
--
-- Only utm_source is persisted on clients — medium/campaign live in the
-- click event metadata. Source is the column 90% of affiliates actually want.
-- ============================================================================

alter table public.clients
  add column referral_utm_source text;

create index clients_referral_utm_source_idx
  on public.clients(sales_rep_id, referral_utm_source)
  where referral_utm_source is not null;
