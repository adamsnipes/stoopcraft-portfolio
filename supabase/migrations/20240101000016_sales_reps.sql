-- ============================================================================
-- Sales rep program
--   sales_reps          one row per onboarded rep (gated by approval)
--   clients.sales_rep_id attribution column (set at client-create time)
--   commission_ledger    one row per paid invoice attributed to a rep
--   payouts              groups ledger rows we've paid out
--   rep_leads            optional CRM-lite for tracking pitches
--
-- Commission accrues on Stripe invoice.paid (50% of gross by default; pct
-- is snapshot per ledger row so changing rep.commission_pct later doesn't
-- rewrite history). No clawback model — a cancelled subscription simply
-- stops producing invoices.
-- ============================================================================

create table public.sales_reps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique,
  name text,
  phone text,
  email text,
  commission_pct integer not null default 50 check (commission_pct between 0 and 100),
  status text not null default 'pending' check (status in ('pending','active','disabled')),
  payout_method text not null default 'manual' check (payout_method in ('manual','stripe_connect')),
  stripe_connect_account_id text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sales_reps_status_idx on public.sales_reps(status);
create index sales_reps_code_idx on public.sales_reps(code);

-- Code shape: lowercase letters / digits / dashes, 3-32 chars. Keeps
-- /?ref=<code> URLs readable and SMS-friendly.
alter table public.sales_reps
  add constraint sales_reps_code_format
  check (code ~ '^[a-z0-9][a-z0-9-]{2,31}$');

-- ============================================================================
-- Attribution column on clients
-- ============================================================================
alter table public.clients
  add column sales_rep_id uuid references public.sales_reps(id) on delete set null;

create index clients_sales_rep_id_idx on public.clients(sales_rep_id);

-- ============================================================================
-- payouts — created first because commission_ledger.payout_id references it
-- ============================================================================
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  sales_rep_id uuid not null references public.sales_reps(id) on delete cascade,
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'usd',
  method text not null default 'manual' check (method in ('manual','stripe_connect')),
  reference text,
  notes text,
  paid_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index payouts_sales_rep_id_idx on public.payouts(sales_rep_id);

-- ============================================================================
-- commission_ledger — one row per Stripe invoice attributed to a rep
-- ============================================================================
create table public.commission_ledger (
  id uuid primary key default gen_random_uuid(),
  sales_rep_id uuid not null references public.sales_reps(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  stripe_invoice_id text not null unique,
  gross_cents integer not null check (gross_cents >= 0),
  commission_pct integer not null check (commission_pct between 0 and 100),
  commission_cents integer not null check (commission_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending','paid','void')),
  payout_id uuid references public.payouts(id) on delete set null,
  accrued_at timestamptz not null default now(),
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index commission_ledger_sales_rep_id_idx on public.commission_ledger(sales_rep_id);
create index commission_ledger_client_id_idx on public.commission_ledger(client_id);
create index commission_ledger_status_idx on public.commission_ledger(status);

-- ============================================================================
-- rep_leads — lightweight CRM so reps can track pitches before they convert
-- ============================================================================
create table public.rep_leads (
  id uuid primary key default gen_random_uuid(),
  sales_rep_id uuid not null references public.sales_reps(id) on delete cascade,
  business_name text not null,
  phone text,
  email text,
  notes text,
  status text not null default 'contacted' check (status in ('contacted','interested','converted','dead')),
  client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rep_leads_sales_rep_id_idx on public.rep_leads(sales_rep_id);

-- ============================================================================
-- updated_at triggers
-- ============================================================================
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger sales_reps_touch_updated_at
  before update on public.sales_reps
  for each row execute function public.touch_updated_at();

create trigger rep_leads_touch_updated_at
  before update on public.rep_leads
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.sales_reps enable row level security;
alter table public.commission_ledger enable row level security;
alter table public.payouts enable row level security;
alter table public.rep_leads enable row level security;

-- sales_reps: a rep can read their own row only. Profile edits (name/phone/
-- payout_method) allowed; status / commission_pct / approved_at / code are
-- admin-controlled — withhold UPDATE on those columns by going through the
-- service-role admin endpoint.
create policy sales_reps_self_select on public.sales_reps for select to authenticated
  using (user_id = auth.uid());

create policy sales_reps_self_update on public.sales_reps for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- commission_ledger: read-only for the owning rep.
create policy commission_ledger_owner_select on public.commission_ledger for select to authenticated
  using (
    exists (
      select 1 from public.sales_reps r
      where r.id = commission_ledger.sales_rep_id and r.user_id = auth.uid()
    )
  );

-- payouts: read-only for the owning rep.
create policy payouts_owner_select on public.payouts for select to authenticated
  using (
    exists (
      select 1 from public.sales_reps r
      where r.id = payouts.sales_rep_id and r.user_id = auth.uid()
    )
  );

-- rep_leads: full CRUD for the owning rep.
create policy rep_leads_owner_select on public.rep_leads for select to authenticated
  using (
    exists (
      select 1 from public.sales_reps r
      where r.id = rep_leads.sales_rep_id and r.user_id = auth.uid()
    )
  );

create policy rep_leads_owner_insert on public.rep_leads for insert to authenticated
  with check (
    exists (
      select 1 from public.sales_reps r
      where r.id = rep_leads.sales_rep_id and r.user_id = auth.uid()
    )
  );

create policy rep_leads_owner_update on public.rep_leads for update to authenticated
  using (
    exists (
      select 1 from public.sales_reps r
      where r.id = rep_leads.sales_rep_id and r.user_id = auth.uid()
    )
  );

create policy rep_leads_owner_delete on public.rep_leads for delete to authenticated
  using (
    exists (
      select 1 from public.sales_reps r
      where r.id = rep_leads.sales_rep_id and r.user_id = auth.uid()
    )
  );

-- clients: reps can read their attributed customers (name, plan, status, etc).
-- This sits alongside the existing owner_user_id policy — Postgres OR-merges
-- multiple permissive SELECT policies, so an owning customer still sees their
-- own row and a rep additionally sees rows where sales_rep_id matches.
create policy clients_sales_rep_select on public.clients for select to authenticated
  using (
    sales_rep_id is not null
    and exists (
      select 1 from public.sales_reps r
      where r.id = clients.sales_rep_id and r.user_id = auth.uid()
    )
  );
