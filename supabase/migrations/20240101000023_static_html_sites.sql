-- ============================================================================
-- Static HTML sites
--
-- A static site is a normal `clients` row that renders a hand-authored HTML
-- bundle (uploaded to R2) instead of the React template. This lets static
-- sites reuse the entire client lifecycle — slug, custom_domain, status
-- (draft→live→claimed), Stripe/claim, DomainManager, contact form — unchanged.
-- The ONLY divergence is rendering, keyed off `render_mode`.
-- ============================================================================

-- 'template' = React template (every existing row). 'static' = served from R2.
alter table public.clients
  add column render_mode text not null default 'template';

alter table public.clients
  add constraint clients_render_mode_check
  check (render_mode in ('template', 'static'));

-- NOTE: niche/city/state stay NOT NULL. Static sites don't have Google-Places
-- data, so the creation path inserts empty strings ('') for them — this keeps
-- the columns (and their non-null TS types, used by the template renderer)
-- unchanged, avoiding a ripple through PublicClient and template components.

-- Proxy resolves the render mode by host on every customer-site request; index
-- the lookup columns. (slug/custom_domain are already unique-indexed.)
create index if not exists idx_clients_render_mode on public.clients(render_mode);
