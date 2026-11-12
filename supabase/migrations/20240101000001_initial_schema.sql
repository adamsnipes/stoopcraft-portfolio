-- Enable extensions
create extension if not exists "uuid-ossp";

-- ============================================================================
-- CLIENTS — One row per business
-- ============================================================================
create table public.clients (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  status text not null default 'draft',          -- draft | live | claimed | cancelled | paused
  niche text not null,                            -- barber | nail_salon | detailer | lawn_care | cleaner | trainer

  -- Business info from Google Places
  google_place_id text unique,
  business_name text not null,
  phone text,
  address text,
  city text not null,
  state text not null,
  postal_code text,
  country text not null default 'US',
  lat double precision,
  lng double precision,

  -- Domain config
  custom_domain text unique,
  domain_owner text default 'platform',           -- 'platform' | 'client'

  -- Stripe
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text,                                      -- 'starter' | 'pro' | 'pro_plus' | null

  -- Lifecycle
  generated_at timestamptz not null default now(),
  claimed_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  hard_delete_at timestamptz,

  -- Auth
  owner_user_id uuid references auth.users(id),

  -- Pre-sale token (token-gated pre-sale view)
  claim_token text unique,

  -- Auditing
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_clients_status on public.clients(status);
create index idx_clients_owner on public.clients(owner_user_id);
create index idx_clients_custom_domain on public.clients(custom_domain) where custom_domain is not null;
create index idx_clients_hard_delete on public.clients(hard_delete_at) where hard_delete_at is not null;

-- ============================================================================
-- CONTENT — Versioned site content per client
-- ============================================================================
create table public.content (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  version integer not null default 1,
  is_published boolean not null default false,

  -- Hero
  hero_headline text,
  hero_subheadline text,
  hero_cta_text text,
  hero_cta_url text,

  -- About
  about_title text,
  about_body text,

  -- Services
  services jsonb default '[]'::jsonb,             -- [{name, description, price?}]

  -- Hours
  hours jsonb default '{}'::jsonb,                -- {monday: {open, close}, ...}

  -- Sections array — drives rendering order and visibility
  sections jsonb not null default '[
    {"type": "hero", "enabled": true, "variant": "image"},
    {"type": "services", "enabled": true, "variant": "grid"},
    {"type": "gallery", "enabled": true, "variant": "masonry"},
    {"type": "about", "enabled": true, "variant": "text"},
    {"type": "booking", "enabled": false, "variant": "embed"},
    {"type": "contact", "enabled": true, "variant": "form"}
  ]'::jsonb,

  -- Theme overrides (CSS variables)
  theme jsonb not null default '{
    "primary": "#1a1a1a",
    "background": "#ffffff",
    "text": "#1a1a1a",
    "accent": "#d4a373",
    "fontHeading": "Playfair Display",
    "fontBody": "Inter",
    "borderRadius": "0.5rem"
  }'::jsonb,

  -- Cal.com integration
  cal_com_link text,

  -- Auditing
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, version)
);

create index idx_content_client on public.content(client_id);
create index idx_content_published on public.content(client_id, is_published) where is_published = true;

-- ============================================================================
-- PHOTOS — Per-client image library
-- ============================================================================
create table public.photos (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  r2_key text not null unique,                    -- "clients/{clientId}/{photoId}.jpg"
  alt_text text,
  position integer not null default 0,
  source text not null default 'google',          -- 'google' | 'uploaded' | 'fallback'
  width integer,
  height integer,
  bytes integer,
  created_at timestamptz not null default now()
);

create index idx_photos_client on public.photos(client_id, position);

-- ============================================================================
-- REQUESTS — Customer change requests
-- ============================================================================
create table public.requests (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references public.clients(id) on delete cascade,
  source text not null,                           -- 'portal' | 'email' | 'admin'
  status text not null default 'open',            -- 'open' | 'in_progress' | 'done' | 'declined'
  body text not null,
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_requests_status on public.requests(status, created_at);
create index idx_requests_client on public.requests(client_id);

-- ============================================================================
-- EVENTS — Audit log + analytics
-- ============================================================================
create table public.events (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  type text not null,
  metadata jsonb default '{}'::jsonb,
  ip_hash text,                                   -- hashed IP, never raw
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_events_client_type on public.events(client_id, type, created_at);
create index idx_events_type on public.events(type, created_at);

-- ============================================================================
-- SUPPRESSION_LIST — SMS opt-outs and bounces
-- ============================================================================
create table public.suppression_list (
  id uuid primary key default uuid_generate_v4(),
  phone text unique,
  email text unique,
  reason text not null,                           -- 'opted_out' | 'bounced' | 'manual'
  source text,
  created_at timestamptz not null default now()
);

create index idx_suppression_phone on public.suppression_list(phone) where phone is not null;
create index idx_suppression_email on public.suppression_list(email) where email is not null;

-- ============================================================================
-- updated_at trigger
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger content_updated_at before update on public.content
  for each row execute function public.set_updated_at();
