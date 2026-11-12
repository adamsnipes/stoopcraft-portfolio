-- Customer-editable section labels. Templates fall back to hardcoded defaults
-- when these are NULL, so existing rows render unchanged.
alter table public.content
  add column if not exists services_title text,
  add column if not exists services_eyebrow text,
  add column if not exists gallery_title text,
  add column if not exists about_eyebrow text;
