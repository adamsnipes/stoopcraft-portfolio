-- ============================================================================
-- platform_settings — single-source-of-truth for runtime-tunable knobs that
-- admin should be able to change without a code deploy. v1 ships with the
-- two commission defaults; expect to grow this over time (welcome-email
-- toggle, plan availability flags, etc.) — keep keys snake_case + scoped
-- (e.g. 'affiliate_*', 'email_*') for readability.
--
-- Per-rep overrides still live on sales_reps.commission_pct. The setting
-- here only seeds the column at signup time and drives the marketing
-- pages' fallback display.
-- ============================================================================

create table public.platform_settings (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.platform_settings (key, value, description) values
  ('affiliate_default_commission_pct', '30',
   'Default commission % stamped onto new affiliate signups. Editable per-affiliate from /admin/reps.'),
  ('rep_default_commission_pct', '50',
   'Default commission % stamped onto new sales-rep signups. Editable per-rep from /admin/reps.');

alter table public.platform_settings enable row level security;
-- No policies = deny all for anon/authenticated. Service-role-only access.
