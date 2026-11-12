// Commission rules — pure data, no DB calls. Lives here so the Stripe
// webhook (commission accrual) and the rep dashboard (display logic) share
// a single source of truth for "which plans pay commission and at what rate".
//
// Today only the Starter plan ships to new customers, but the structure is
// open so future plans only need a one-line opt-in.

import { PRICING, type PlanKey } from '@/lib/pricing';

// Plans a rep is allowed to generate payment links for, and from which
// invoices accrue commission. Adding 'pro' here would automatically:
//   - surface the plan in the rep payment-link picker
//   - accrue commission on pro invoices
// ⚠️ Do NOT include one-time plans (setup) — commission is recurring-only.
export const COMMISSION_ELIGIBLE_PLANS: ReadonlyArray<PlanKey> = ['starter'];

export function isCommissionEligiblePlan(plan: string | null | undefined): plan is PlanKey {
  if (!plan) return false;
  return (COMMISSION_ELIGIBLE_PLANS as readonly string[]).includes(plan);
}

// Monthly revenue in cents for a given commission-eligible plan. Returns
// 0 for ineligible / unknown plans so callers can sum safely.
export function planMonthlyCents(plan: string | null | undefined): number {
  if (!isCommissionEligiblePlan(plan)) return 0;
  const entry = PRICING[plan];
  const monthly = 'monthly' in entry ? entry.monthly : undefined;
  return monthly ? monthly * 100 : 0;
}

export function commissionCentsFromGross(grossCents: number, pct: number): number {
  return Math.floor((grossCents * pct) / 100);
}
