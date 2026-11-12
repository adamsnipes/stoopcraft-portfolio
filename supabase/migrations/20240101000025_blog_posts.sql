-- ============================================================================
-- Blog posts — first-party, admin-managed CMS for client sites.
--
-- TENANT ISOLATION (the explicit requirement): a post belongs to exactly one
-- client, and isolation is enforced two independent ways:
--   1. Every server query scopes by client_id (the access layer in
--      lib/blog/posts.ts requires it on every call).
--   2. RLS is ON with NO policies, so the table is unreachable by the anon /
--      authenticated roles entirely. ALL access goes through service-role
--      server code that scopes by client_id. One client can never read or
--      write another client's posts, and nothing is addressable cross-tenant.
-- ============================================================================

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  slug text not null,
  title text not null,
  excerpt text,
  cover_image_url text,
  -- Sanitized HTML from the TipTap editor (sanitize-html on save).
  body_html text not null default '',
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published')),
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Slugs are unique PER CLIENT, so two clients can each have /blog/welcome.
  unique (client_id, slug)
);

-- Common lookup: a client's published posts, newest first.
create index idx_posts_client_published
  on public.posts (client_id, status, published_at desc);

-- Deny-by-default. RLS on, no policies → only the service role (server code)
-- can touch the table. Public blog pages and the admin editor both go through
-- client_id-scoped service-role queries; there is no direct client access path.
alter table public.posts enable row level security;
