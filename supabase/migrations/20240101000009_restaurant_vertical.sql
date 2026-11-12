-- Restaurant vertical support. Additive across the board: every new column is
-- nullable / has a benign default so existing rows render byte-identical.
-- Vertical itself is derived server-side from the niche (no API contract change),
-- but persisted on `clients` because compositions / portal routing / photo
-- limits all need fast access without re-deriving from the niche each time.

-- ── clients ──────────────────────────────────────────────────────────────────
-- business_vertical is NULL for every existing row → existing template path
-- runs unchanged. Populated only when the niche maps to a non-default vertical
-- (currently only 'restaurant').
alter table public.clients
  add column if not exists business_vertical text;

alter table public.clients
  add constraint clients_business_vertical_check
  check (business_vertical is null or business_vertical in ('restaurant'));

-- POS prep — empty in v1, populated when the OAuth integration ships.
alter table public.clients
  add column if not exists pos_provider text,
  add column if not exists pos_external_id text;

alter table public.clients
  add constraint clients_pos_provider_check
  check (pos_provider is null or pos_provider in ('square', 'toast', 'clover', 'lightspeed'));

-- ── content ──────────────────────────────────────────────────────────────────
-- Restaurants populate `menu`, salons populate `services` — the two never
-- coexist on the same row, but both columns exist so neither path needs to
-- discriminate on its data shape.
alter table public.content
  add column if not exists menu jsonb,
  add column if not exists menu_title text,
  add column if not exists menu_eyebrow text,
  add column if not exists ordering_links jsonb,
  add column if not exists reservations_method text,
  add column if not exists reservations_url text;

alter table public.content
  add constraint content_reservations_method_check
  check (reservations_method is null or reservations_method in ('opentable', 'resy', 'tock', 'phone', 'walkin'));

-- ── photos ───────────────────────────────────────────────────────────────────
-- Existing rows default to 'gallery' → today's photo manager + Gallery
-- component see exactly the photos they saw before. Menu-item photos get
-- their own purpose so they don't count against the gallery cap and don't
-- show up in the gallery section.
alter table public.photos
  add column if not exists purpose text not null default 'gallery';

alter table public.photos
  add constraint photos_purpose_check
  check (purpose in ('gallery', 'menu_item', 'hero', 'logo'));

-- ── pos_credentials ──────────────────────────────────────────────────────────
-- One row per client; cascade-deletes when the client is removed. access_token
-- is stored encrypted at the application layer (libsodium), not via pgcrypto —
-- key rotation is simpler outside the DB.
create table if not exists public.pos_credentials (
  client_id uuid primary key references public.clients(id) on delete cascade,
  provider text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.pos_credentials
  add constraint pos_credentials_provider_check
  check (provider in ('square', 'toast', 'clover', 'lightspeed'));

-- RLS on, no public policies → only service-role (which bypasses RLS) can
-- read these tokens. Customers never query this table directly; the OAuth
-- flow + nightly sync both run server-side.
alter table public.pos_credentials enable row level security;
