-- Funnel session id on clients. Set when /api/generate creates the row —
-- carries the client-generated UUID that follows a visitor across the
-- entire funnel (search → build → checkout → webhook → downstream
-- provisioning). Used purely for log correlation in Axiom; nothing
-- functional depends on this column.
--
-- Nullable + no backfill: rows created before this rollout don't have a
-- session id, and that's fine — their logs already aged out by the time
-- this is in use, and Axiom queries by session_id naturally exclude them.

alter table public.clients
  add column if not exists funnel_session_id text;
