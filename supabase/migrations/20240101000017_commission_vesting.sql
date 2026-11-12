-- ============================================================================
-- Commission vesting — first-invoice 14-day waiting period
--
-- Reps don't get paid out for a customer's FIRST invoice until 14 days have
-- passed without cancellation. Renewals after that vest immediately (the
-- customer already proved they're not bait-and-cancel). Per-row vests_at
-- timestamp drives payout eligibility + admin countdown UI.
--
-- Existing rows: backfilled to accrued_at so they're already vested. No
-- rep loses commission they were already owed under the old "pay every
-- pending row" rule.
-- ============================================================================

alter table public.commission_ledger
  add column vests_at timestamptz not null default now();

-- Backfill existing rows: vested immediately (matches pre-rule behavior).
update public.commission_ledger set vests_at = accrued_at;

create index commission_ledger_vests_at_idx on public.commission_ledger(vests_at);
