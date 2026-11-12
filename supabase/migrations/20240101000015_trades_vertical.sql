-- Expand the clients.business_vertical CHECK constraint to allow 'trades'.
--
-- Background: 20240101000009 introduced business_vertical with a CHECK that
-- only allowed 'restaurant'. The trades family (contractor / lead-gen template)
-- now writes 'trades' into the same column. Insert was failing with a check
-- constraint violation surfaced to the API as `db_insert_failed`.
--
-- The column stays nullable for the original (salon/appointment) vertical.

alter table public.clients
  drop constraint if exists clients_business_vertical_check;

alter table public.clients
  add constraint clients_business_vertical_check
  check (business_vertical is null or business_vertical in ('restaurant', 'trades'));
