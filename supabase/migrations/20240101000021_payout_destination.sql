-- ============================================================================
-- Rep payout destination — where we actually send the money. Two methods
-- supported for v1: PayPal (email) and Venmo (handle). Stripe Connect kept
-- in the constraint for the future-automation path; it's not exposed in the
-- settings UI yet.
--
-- payout_method = NULL means "not set up." Admin's "Mark as paid" button
-- is gated on this — you can't issue a payout until the rep tells us where
-- to send it. Existing 'manual' rows (from before this migration) are
-- normalized to NULL so they show as "needs setup" in the UI.
-- ============================================================================

alter table public.sales_reps
  drop constraint if exists sales_reps_payout_method_check;

-- Old default was 'manual' (a placeholder). Drop it so new rows default to
-- NULL until the rep picks PayPal or Venmo.
alter table public.sales_reps
  alter column payout_method drop default;

alter table public.sales_reps
  alter column payout_method drop not null;

-- Normalize legacy values to NULL — 'manual' was never a real destination.
update public.sales_reps
  set payout_method = null
  where payout_method = 'manual';

alter table public.sales_reps
  add constraint sales_reps_payout_method_check
  check (payout_method is null or payout_method in ('paypal', 'venmo', 'stripe_connect'));

-- The actual identifier — email for PayPal, @handle for Venmo. App layer
-- enforces format per method.
alter table public.sales_reps
  add column payout_destination text;
