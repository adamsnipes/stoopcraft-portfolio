-- ============================================================================
-- Sales-rep program forks into two flavors:
--   'rep'       — active outreach. Pitches individual businesses, generates
--                 sites for prospects. Higher commission (default 50%).
--                 Manual approval (status starts 'pending').
--   'affiliate' — passive link-sharing. No generate/leads UI; just shares
--                 their /r/<code> URL. Lower commission (default 20%).
--                 Self-serve (status starts 'active' on signup).
--
-- Same underlying tables, ledger, payout flow — the kind column drives UI
-- visibility + signup defaults only.
-- ============================================================================

alter table public.sales_reps
  add column kind text not null default 'rep'
  check (kind in ('rep', 'affiliate'));

create index sales_reps_kind_idx on public.sales_reps(kind);
