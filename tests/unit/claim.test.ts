import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/revalidation', () => ({ revalidateClientSite: vi.fn() }));

import { claimClient } from '../../apps/web/lib/claim';

type Row = {
  status: string;
  owner_user_id: string | null;
  claimed_at: string | null;
  slug: string;
  custom_domain: string | null;
};

function fakeAdmin(row: Row) {
  const updates: Record<string, unknown>[] = [];
  const admin = {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: row }) }) }),
      update: (u: Record<string, unknown>) => {
        updates.push(u);
        return { eq: async () => ({}) };
      },
    }),
    auth: {
      admin: {
        generateLink: async () => ({ data: { user: { id: 'new-owner' } }, error: null }),
      },
    },
  };
  return { admin: admin as unknown as Parameters<typeof claimClient>[0], updates };
}

const claimed: Row = {
  status: 'claimed',
  owner_user_id: 'owner',
  claimed_at: '2026-01-01T00:00:00.000Z',
  slug: 'acme',
  custom_domain: null,
};

describe('claimClient and a recorded cancellation', () => {
  // The bug: a claimed client who resubscribed counted as an upsell, kept its
  // cancellation dates, stayed offline and stayed on course for hard delete.
  it('clears the cancellation when a claimed client pays with a subscription', async () => {
    const { admin, updates } = fakeAdmin(claimed);
    await claimClient(admin, {
      clientId: 'c',
      plan: 'starter',
      email: null,
      stripeSubscriptionId: 'sub_new',
    });
    expect(updates[0]).toMatchObject({
      stripe_subscription_id: 'sub_new',
      cancelled_at: null,
      expires_at: null,
      hard_delete_at: null,
    });
    expect(updates[0]).not.toHaveProperty('status');
    expect(updates[0]).not.toHaveProperty('claimed_at');
  });

  // One-time payments and cash carry no subscription, so they say nothing about
  // whether a cancelled client is paying again.
  it('leaves the cancellation alone without a subscription', async () => {
    const { admin, updates } = fakeAdmin(claimed);
    await claimClient(admin, { clientId: 'c', plan: 'setup', email: null });
    expect(updates[0]).not.toHaveProperty('cancelled_at');
    expect(updates[0]).not.toHaveProperty('hard_delete_at');
  });

  it('keeps the original claimed_at when restoring a row moved off claimed', async () => {
    const { admin, updates } = fakeAdmin({ ...claimed, status: 'live' });
    await claimClient(admin, {
      clientId: 'c',
      plan: 'starter',
      email: null,
      stripeSubscriptionId: 'sub_new',
    });
    expect(updates[0]).toMatchObject({ status: 'claimed', claimed_at: claimed.claimed_at });
  });

  it('gives a claimed row with no owner one, since it cannot serve without', async () => {
    const { admin, updates } = fakeAdmin({ ...claimed, owner_user_id: null });
    await claimClient(admin, {
      clientId: 'c',
      plan: 'starter',
      email: 'a@example.com',
      stripeSubscriptionId: 'sub_new',
    });
    expect(updates[0]).toMatchObject({ owner_user_id: 'new-owner' });
  });
});
