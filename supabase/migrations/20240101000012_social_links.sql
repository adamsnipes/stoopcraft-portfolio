-- Customer social links (facebook, instagram, etc.). Renders as icons in the
-- site footer. Stored as jsonb array of { platform, url } objects, mirroring
-- the ordering_links shape so the editor + parser stay symmetric.
--
-- NULL = section absent on legacy rows (pre-migration); the renderer treats
-- NULL the same as an empty array. New generations seed two empty-URL
-- placeholders (facebook + instagram) so admins / customers see the platforms
-- in the editor without manually adding them.
alter table public.content
  add column if not exists social_links jsonb;
