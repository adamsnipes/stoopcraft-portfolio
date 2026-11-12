import { describe, it, expect } from 'vitest';
import {
  cancellationFields,
  cancellationHasEnded,
  cancellationSync,
  isSupersededSubscription,
  subscriptionLinkBlocker,
  CANCELLATION_GRACE_DAYS,
} from '../../apps/web/lib/cancellation';

const NOW = new Date('2026-10-21T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const PERIOD_END = new Date('2026-11-15T00:00:00Z');
const PERIOD_END_SEC = PERIOD_END.getTime() / 1000;

describe('cancellationFields', () => {
  it('records now, the period end, and period end + the grace period', () => {
    const f = cancellationFields(PERIOD_END.getTime(), NOW);
    expect(f.cancelled_at).toBe(NOW.toISOString());
    expect(f.expires_at).toBe(PERIOD_END.toISOString());
    expect(f.hard_delete_at).toBe(new Date(PERIOD_END.getTime() + CANCELLATION_GRACE_DAYS * DAY).toISOString());
  });
});

// The site must keep serving through the paid period after a cancel — that's
// what the cancellation policy, the portal and the emails promise.
describe('cancellationHasEnded', () => {
  it('is false for a client that never cancelled', () => {
    expect(cancellationHasEnded({ cancelled_at: null, expires_at: null }, NOW)).toBe(false);
  });

  it('is false while the paid period is still running', () => {
    const row = { cancelled_at: NOW.toISOString(), expires_at: PERIOD_END.toISOString() };
    expect(cancellationHasEnded(row, NOW)).toBe(false);
  });

  it('is true once expires_at has passed', () => {
    const row = { cancelled_at: NOW.toISOString(), expires_at: PERIOD_END.toISOString() };
    expect(cancellationHasEnded(row, new Date(PERIOD_END.getTime() + 1))).toBe(true);
    expect(cancellationHasEnded(row, PERIOD_END)).toBe(true);
  });

  it('treats a cancellation with no end date as ended', () => {
    expect(cancellationHasEnded({ cancelled_at: NOW.toISOString(), expires_at: null }, NOW)).toBe(true);
  });
});

describe('cancellationSync (customer.subscription.updated)', () => {
  const notCancelled = { cancelled_at: null, expires_at: null };

  it('records a cancel made elsewhere (e.g. Stripe billing portal)', () => {
    const u = cancellationSync({ cancel_at: PERIOD_END_SEC, status: 'active' }, notCancelled, NOW);
    expect(u).toEqual(cancellationFields(PERIOD_END.getTime(), NOW));
  });

  it('does nothing when the recorded cancellation already matches', () => {
    const current = { cancelled_at: '2026-10-01T00:00:00.000Z', expires_at: PERIOD_END.toISOString() };
    expect(cancellationSync({ cancel_at: PERIOD_END_SEC, status: 'active' }, current, NOW)).toBeNull();
  });

  it('moves the dates (keeping cancelled_at) when the end date changes', () => {
    const current = { cancelled_at: '2026-10-01T00:00:00.000Z', expires_at: '2026-11-01T00:00:00.000Z' };
    const u = cancellationSync({ cancel_at: PERIOD_END_SEC, status: 'active' }, current, NOW);
    expect(u?.cancelled_at).toBe(current.cancelled_at);
    expect(u?.expires_at).toBe(PERIOD_END.toISOString());
  });

  // Renewing before the period ends must clear the fields, or the hard-delete
  // cron would delete a paying customer's site at the old date.
  it('clears a recorded cancellation when the subscription is renewed', () => {
    const current = { cancelled_at: NOW.toISOString(), expires_at: PERIOD_END.toISOString() };
    for (const status of ['active', 'trialing', 'past_due']) {
      expect(cancellationSync({ cancel_at: null, status }, current, NOW)).toEqual({
        cancelled_at: null,
        expires_at: null,
        hard_delete_at: null,
      });
    }
  });

  it('leaves a cancellation alone when the subscription is not live', () => {
    const current = { cancelled_at: NOW.toISOString(), expires_at: PERIOD_END.toISOString() };
    for (const status of ['canceled', 'unpaid', 'incomplete_expired']) {
      expect(cancellationSync({ cancel_at: null, status }, current, NOW)).toBeNull();
    }
  });

  it('does nothing for an ordinary update on a non-cancelled client', () => {
    expect(cancellationSync({ cancel_at: null, status: 'active' }, notCancelled, NOW)).toBeNull();
  });
});

describe('subscriptionLinkBlocker (admin reactivation)', () => {
  const CLIENT = 'client-a';
  const live = { status: 'active', cancel_at: null, metadata: {} };

  // Made by hand in Stripe: this is the case the tool exists for.
  it('allows a live subscription with no metadata', () => {
    expect(subscriptionLinkBlocker(live, CLIENT)).toBeNull();
    expect(subscriptionLinkBlocker({ ...live, metadata: null }, CLIENT)).toBeNull();
  });

  it('allows one already stamped for this client', () => {
    expect(subscriptionLinkBlocker({ ...live, metadata: { client_id: CLIENT } }, CLIENT)).toBeNull();
  });

  // The Stripe account is shared with Scoop Unity.
  it('refuses another platform, even when it is live', () => {
    const sub = { ...live, metadata: { platform: 'scoopunity' } };
    expect(subscriptionLinkBlocker(sub, CLIENT)).toBe('other_platform');
    expect(subscriptionLinkBlocker({ ...live, metadata: { platform: 'stoopcraft' } }, CLIENT)).toBeNull();
  });

  it('refuses a subscription stamped for a different client', () => {
    const sub = { ...live, metadata: { client_id: 'client-b' } };
    expect(subscriptionLinkBlocker(sub, CLIENT)).toBe('other_client');
  });

  it('refuses anything that is not billing', () => {
    for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']) {
      expect(subscriptionLinkBlocker({ ...live, status }, CLIENT)).toBe('not_live');
    }
  });

  it('refuses a subscription still scheduled to end', () => {
    expect(subscriptionLinkBlocker({ ...live, cancel_at: PERIOD_END_SEC }, CLIENT)).toBe('scheduled_to_end');
  });
});

// An old subscription ending after the client moved to a new one must not cancel them.
describe('isSupersededSubscription', () => {
  it('is true when the client is on a different subscription', () => {
    expect(isSupersededSubscription('sub_old', 'sub_new')).toBe(true);
  });

  it('is false for the subscription the client is on', () => {
    expect(isSupersededSubscription('sub_new', 'sub_new')).toBe(false);
  });

  it('is false when the client has no subscription on record', () => {
    expect(isSupersededSubscription('sub_any', null)).toBe(false);
  });
});
