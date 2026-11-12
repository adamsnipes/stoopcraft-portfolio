-- ============================================================================
-- Enable RLS on every table
-- ============================================================================
alter table public.clients enable row level security;
alter table public.content enable row level security;
alter table public.photos enable row level security;
alter table public.requests enable row level security;
alter table public.events enable row level security;
alter table public.suppression_list enable row level security;

-- ============================================================================
-- CLIENTS policies
-- ============================================================================

-- Anon: can SELECT only CLAIMED clients (post-sale, with owner, not cancelled).
-- Pre-sale (status='live', no owner) requires service role + token validation at app layer.
-- See DECISIONS.md Decision 3.
create policy clients_anon_select on public.clients for select to anon
  using (
    status = 'claimed'
    and cancelled_at is null
    and owner_user_id is not null
  );

-- Authenticated customers: can SELECT their own row only
create policy clients_owner_select on public.clients for select to authenticated
  using (owner_user_id = auth.uid());

-- Authenticated customers: can UPDATE limited fields on their own row
create policy clients_owner_update on public.clients for update to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- No INSERT or DELETE for anon or authenticated. Service role only.

-- ============================================================================
-- CONTENT policies
-- ============================================================================

-- Anon: can SELECT published content for claimed, uncancelled, owned clients only
create policy content_anon_select on public.content for select to anon
  using (
    is_published = true
    and exists (
      select 1 from public.clients c
      where c.id = content.client_id
      and c.status = 'claimed'
      and c.cancelled_at is null
      and c.owner_user_id is not null
    )
  );

-- Authenticated customers: can SELECT and UPDATE their own content
create policy content_owner_select on public.content for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = content.client_id and c.owner_user_id = auth.uid()
    )
  );

create policy content_owner_update on public.content for update to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = content.client_id and c.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- PHOTOS policies
-- ============================================================================

-- Anon: can SELECT photos for claimed, uncancelled, owned clients only
create policy photos_anon_select on public.photos for select to anon
  using (
    exists (
      select 1 from public.clients c
      where c.id = photos.client_id
      and c.status = 'claimed'
      and c.cancelled_at is null
      and c.owner_user_id is not null
    )
  );

-- Authenticated customers: can SELECT their own photos
create policy photos_owner_select on public.photos for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = photos.client_id and c.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- REQUESTS policies
-- ============================================================================

-- Authenticated customers: can SELECT and INSERT requests for their own client
create policy requests_owner_select on public.requests for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.id = requests.client_id and c.owner_user_id = auth.uid()
    )
  );

create policy requests_owner_insert on public.requests for insert to authenticated
  with check (
    exists (
      select 1 from public.clients c
      where c.id = requests.client_id and c.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- EVENTS policies — write-only for anon/authenticated, read service-role only
-- ============================================================================
create policy events_insert on public.events for insert to anon, authenticated
  with check (true);

-- No SELECT for anon/authenticated. Service role only.

-- ============================================================================
-- SUPPRESSION_LIST — service role only, no anon/authenticated access
-- ============================================================================
-- RLS enabled (above) with no policies = deny all for anon/authenticated.

-- ============================================================================
-- Verify: every public table has RLS enabled
-- ============================================================================
do $$
declare
  tbl record;
begin
  for tbl in
    select tablename from pg_tables
    where schemaname = 'public'
    and tablename not like 'pg_%'
  loop
    if not exists (
      select 1 from pg_class
      where relname = tbl.tablename
      and relrowsecurity = true
    ) then
      raise exception 'RLS not enabled on table: %', tbl.tablename;
    end if;
  end loop;
end $$;
