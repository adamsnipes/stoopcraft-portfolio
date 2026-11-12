-- Append the new 'follow' section to every content row that doesn't already
-- have it. Section availability is cross-vertical: the editor decides whether
-- to surface it per client, not the schema. Default-enabled for non-restaurant
-- clients (Instagram/TikTok IS the portfolio for barbers/salons), default-
-- disabled for restaurants so they opt in instead of opting out.
--
-- Idempotent: the NOT EXISTS guard means re-running this migration after a
-- manual edit/regenerate won't duplicate the entry.
update public.content c
set sections = coalesce(c.sections, '[]'::jsonb)
  || jsonb_build_array(
       jsonb_build_object(
         'type', 'follow',
         'enabled', cl.business_vertical is distinct from 'restaurant',
         'variant', 'icons'
       )
     )
from public.clients cl
where c.client_id = cl.id
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(c.sections, '[]'::jsonb)) s
    where s->>'type' = 'follow'
  );
