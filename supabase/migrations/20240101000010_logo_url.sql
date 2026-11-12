-- Logo URL on clients. Nullable, applies to every vertical (salon and
-- restaurant) — when set, Nav and Footer render the image instead of the
-- business_name text. Mirrors favicon_url: just a URL pointing at R2;
-- we don't track variants, image dimensions, or content type on the row.

alter table public.clients
  add column if not exists logo_url text;
