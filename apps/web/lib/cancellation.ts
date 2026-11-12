// ============================================================================
// Cancellation window — pure rules shared by the site server, the Stripe
// webhook and the cancel routes (no imports, so they're unit-testable).
//
// Cancelling (customer portal, admin, or Stripe's own billing portal) schedules
// the subscription to end at the period end. Our three fields mirror that:
//   cancelled_at    when the cancellation was recorded
//   expires_at      when the paid period ends — the site stays up until then
//   hard_delete_at  expires_at + CANCELLATION_GRACE_DAYS — the cron deletes after
// ============================================================================

export const CANCELLATION_GRACE_DAYS = 60;

/** A recorded cancellation: all three dates set. */
export type ScheduledCancellation = {
  cancelled_at: string;
  expires_at: string;
  hard_delete_at: string;
};

/** An update to the three fields: a scheduled cancellation, or all null (cleared). */
export type CancellationFields =
  | ScheduledCancellation
  | { cancelled_at: null; expires_at: null; hard_delete_at: null };

const DAY_MS = 24 * 60 * 60 * 1000;

/** The three fields for a subscription whose paid period ends at `periodEndMs`. */
export function cancellationFields(periodEndMs: number, now: Date = new Date()): ScheduledCancellation {
  return {
    cancelled_at: now.toISOString(),
    expires_at: new Date(periodEndMs).toISOString(),
    hard_delete_at: new Date(periodEndMs + CANCELLATION_GRACE_DAYS * DAY_MS).toISOString(),
  };
}

/**
 * True once a cancelled client's paid period is over, i.e. the site should go
 * offline. Not cancelled → false. Cancelled with no end date on record → true
 * (nothing says they've paid for more time).
 */
export function cancellationHasEnded(
  row: { cancelled_at: string | null; expires_at: string | null },
  now: Date = new Date(),
): boolean {
  if (!row.cancelled_at) return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() <= now.getTime();
}

// A subscription in one of these states is still alive and billing.
export const LIVE_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing', 'past_due']);

/**
 * Keep a client's cancellation fields in step with its Stripe subscription
 * (customer.subscription.updated). Returns the update to apply, or null.
 *
 *   - Scheduled to end (`cancel_at` set): record it if we haven't — covers a
 *     cancel made in Stripe's billing portal — or move the dates if the end
 *     changed. An existing `cancelled_at` is kept.
 *   - No longer scheduled to end, still live: clear all three. This is the
 *     renew-before-period-end case; without it the hard-delete cron would remove
 *     a paying customer's site at the old date.
 */
export function cancellationSync(
  sub: { cancel_at: number | null; status: string },
  current: { cancelled_at: string | null; expires_at: string | null },
  now: Date = new Date(),
): CancellationFields | null {
  if (sub.cancel_at) {
    const next = cancellationFields(sub.cancel_at * 1000, now);
    if (current.cancelled_at) {
      if (current.expires_at && new Date(current.expires_at).getTime() === sub.cancel_at * 1000) {
        return null;
      }
      return { ...next, cancelled_at: current.cancelled_at };
    }
    return next;
  }

  if (current.cancelled_at && LIVE_SUBSCRIPTION_STATUSES.has(sub.status)) {
    return { cancelled_at: null, expires_at: null, hard_delete_at: null };
  }

  return null;
}

/** Why a subscription can't bring a client's site back. */
export type SubscriptionLinkBlocker =
  | 'other_platform'
  | 'other_client'
  | 'not_live'
  | 'scheduled_to_end';

/**
 * Whether a Stripe subscription can be linked to a client to reactivate it
 * (admin Billing tab). Null = it can. The Stripe account is shared with Scoop
 * Unity, so a pasted id isn't trusted to be ours. No client_id is fine: that's
 * what a subscription created by hand in Stripe looks like. A subscription still
 * scheduled to end has nothing to reactivate: the site serves until that date.
 */
export function subscriptionLinkBlocker(
  sub: { status: string; cancel_at: number | null; metadata: Record<string, string> | null },
  clientId: string,
): SubscriptionLinkBlocker | null {
  const platform = sub.metadata?.['platform'];
  if (platform && platform !== 'stoopcraft') return 'other_platform';
  const linkedClient = sub.metadata?.['client_id'];
  if (linkedClient && linkedClient !== clientId) return 'other_client';
  if (!LIVE_SUBSCRIPTION_STATUSES.has(sub.status)) return 'not_live';
  if (sub.cancel_at) return 'scheduled_to_end';
  return null;
}

/**
 * True when a webhook event is about a subscription the client has since moved
 * off. Their old one ending later is not a cancellation: acting on it would take
 * a paying client offline. A client with no subscription on record can't be
 * superseded.
 */
export function isSupersededSubscription(
  subscriptionId: string,
  clientSubscriptionId: string | null,
): boolean {
  return !!clientSubscriptionId && clientSubscriptionId !== subscriptionId;
}
