-- ============================================================================
-- Admin manual emails — a log of one-off emails the operator composes and
-- sends to clients from /admin/emails (subject + plain-text body, wrapped in
-- the StoopCraft branded shell and sent via Resend from notifications@).
--
-- Unlike the transactional templates, these are free-composed and addressed to
-- an arbitrary recipient the admin types/selects, so we persist a copy here to
-- give the admin a "previously sent" history. Test sends (to the internal
-- preview inbox) are logged too, flagged is_test = true.
-- ============================================================================

create table public.admin_emails (
  id uuid primary key default gen_random_uuid(),
  -- Optional link to the client this was addressed to (when picked from the
  -- dropdown). Free-typed recipients leave this null. SET NULL on delete so the
  -- history survives a client being removed.
  client_id uuid references public.clients(id) on delete set null,
  to_email text not null,
  subject text not null,
  -- The raw plain-text body the admin typed (pre-shell). Kept so history shows
  -- exactly what was written, not the rendered HTML.
  body text not null,
  is_test boolean not null default false,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  -- Resend message id on success; error string on failure.
  resend_id text,
  error text,
  -- Admin email that triggered the send (from the auth session).
  sent_by text,
  created_at timestamptz not null default now()
);

-- History view: newest first.
create index idx_admin_emails_created on public.admin_emails (created_at desc);

-- Deny-by-default. RLS on, no policies → only the service role (admin server
-- code) can read or write. There is no client-facing access path.
alter table public.admin_emails enable row level security;
