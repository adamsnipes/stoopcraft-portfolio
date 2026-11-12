-- ============================================================================
-- Lead scraper tables — admin-only Google Places + Twilio LTI scraper that
-- finds local businesses without real websites for outbound pitching.
--
-- Three tables:
--   scrape_runs        — one row per /admin/scrape-leads submission. Tracks
--                        params, counts, and API spend so admin can see
--                        what each run cost.
--   scraped_seen_places — every place_id we've examined per (niche, city),
--                        including rejections. Lets re-runs skip places we
--                        already saw (cheap Google call, no Twilio call).
--                        The key efficiency win: don't pay Twilio twice.
--   scraped_leads      — the subset of seen places that passed every filter
--                        (no website, mobile phone, not a chain, etc.).
--
-- City strings are user-supplied free text. We canonicalize (lowercase,
-- trim, collapse whitespace) before storing for dedupe. The raw city the
-- user typed is preserved in scrape_runs.location_input for audit.
--
-- All tables have RLS enabled with no policies — service-role-only access.
-- The API route gates on ADMIN_EMAIL before touching them.
-- ============================================================================

create table public.scrape_runs (
  id                       uuid primary key default gen_random_uuid(),
  niche                    text not null,
  niche_preset             text,
  location_input           text not null,
  canonical_city           text not null,
  target_count             integer not null,
  no_website_only          boolean not null default true,
  mobile_only              boolean not null default true,
  force_recheck_seen       boolean not null default false,
  leads_found              integer not null default 0,
  candidates_seen          integer not null default 0,
  candidates_skipped_seen  integer not null default 0,
  places_api_calls         integer not null default 0,
  twilio_api_calls         integer not null default 0,
  status                   text not null default 'running',
  error_message            text,
  started_at               timestamptz not null default now(),
  finished_at              timestamptz,
  constraint scrape_runs_status_check
    check (status in ('running', 'success', 'partial', 'error'))
);

create table public.scraped_seen_places (
  place_id        text not null,
  niche           text not null,
  canonical_city  text not null,
  decision        text not null,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  last_run_id     uuid references public.scrape_runs(id) on delete set null,
  primary key (place_id, niche),
  constraint scraped_seen_places_decision_check
    check (decision in (
      'kept', 'chain', 'adjacent', 'has_website', 'no_phone',
      'not_mobile', 'blocked_carrier', 'closed', 'duplicate_phone',
      'invalid_phone'
    ))
);

create table public.scraped_leads (
  place_id                text primary key,
  scrape_run_id           uuid not null references public.scrape_runs(id) on delete cascade,
  business_name           text not null,
  address                 text,
  phone                   text not null,
  normalized_phone        text not null,
  niche                   text not null,
  canonical_city          text not null,
  location_input          text not null,
  rating                  numeric(2, 1),
  review_count            integer,
  uses_social_as_website  boolean not null default false,
  website_uri             text,
  line_type               text,
  scraped_at              timestamptz not null default now()
);

-- Dedupe lookup: "have we seen this (niche, city) recently?" — used
-- before Twilio to skip places we already validated.
create index idx_seen_places_niche_city
  on public.scraped_seen_places (niche, canonical_city, last_seen_at desc);

-- Cross-city phone dedupe — same business sometimes shows up under
-- multiple neighborhood listings.
create index idx_scraped_leads_phone on public.scraped_leads (normalized_phone);
create index idx_scraped_leads_niche_city on public.scraped_leads (niche, canonical_city);
create index idx_scraped_leads_run on public.scraped_leads (scrape_run_id);

alter table public.scrape_runs enable row level security;
alter table public.scraped_seen_places enable row level security;
alter table public.scraped_leads enable row level security;
-- No policies = deny all for anon/authenticated. Service-role-only.
