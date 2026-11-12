import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const CLIENT_ID = 'client-a';

const state = vi.hoisted(() => ({
  user: { email: 'admin@example.com' } as { email: string } | null,
  row: {} as Record<string, unknown>,
  conflicts: [] as { id: string }[],
  conflictFilter: '',
  events: [] as Record<string, unknown>[],
  sub: {} as Record<string, unknown>,
  retrieve: vi.fn(),
  update: vi.fn(),
  list: vi.fn(),
  claimClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }),
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === 'events') {
        return {
          insert: async (e: Record<string, unknown>) => {
            state.events.push(e);
            return {};
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({ single: async () => ({ data: state.row }) }),
          or: (filter: string) => {
            state.conflictFilter = filter;
            return { neq: () => ({ limit: async () => ({ data: state.conflicts }) }) };
          },
        }),
      };
    },
  }),
}));

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    subscriptions: { retrieve: state.retrieve, update: state.update, list: state.list },
  }),
}));
vi.mock('@/lib/claim', () => ({ claimClient: state.claimClient }));
vi.mock('@/lib/r2/static-site', () => ({ getStaticObject: async () => ({ body: new Uint8Array() }) }));

import { GET, POST } from '../../apps/web/app/api/admin/clients/[id]/subscription/route';

const context = { params: Promise.resolve({ id: CLIENT_ID }) };

// next/server only resolves inside apps/web, so the route gets just what it reads.
function post(subscriptionId: string) {
  const req = { json: async () => ({ subscription_id: subscriptionId }) };
  return POST(req as unknown as NextRequest, context);
}

beforeEach(() => {
  process.env.ADMIN_EMAIL = 'admin@example.com';
  state.user = { email: 'admin@example.com' };
  state.conflicts = [];
  state.conflictFilter = '';
  state.events = [];
  state.row = {
    id: CLIENT_ID,
    slug: 'acme',
    status: 'claimed',
    plan: 'starter',
    render_mode: 'static',
    owner_user_id: 'owner',
    cancelled_at: '2026-09-01T00:00:00.000Z',
    expires_at: '2026-10-01T00:00:00.000Z',
    hard_delete_at: '2026-11-30T00:00:00.000Z',
    stripe_customer_id: 'cus_a',
    stripe_subscription_id: 'sub_old',
  };
  // A subscription made by hand in Stripe: live, no metadata.
  state.sub = {
    id: 'sub_new',
    customer: { id: 'cus_a', email: 'owner@example.com' },
    status: 'active',
    cancel_at: null,
    metadata: {},
  };
  state.retrieve.mockReset().mockImplementation(async () => state.sub);
  state.update.mockReset().mockResolvedValue({});
  state.list.mockReset();
  // The real claimClient writes the row; the route re-reads it to confirm.
  state.claimClient.mockReset().mockImplementation(async () => {
    state.row = {
      ...state.row,
      stripe_subscription_id: 'sub_new',
      cancelled_at: null,
      expires_at: null,
      hard_delete_at: null,
    };
    return { ownerUserId: 'owner', isUpsell: true, client: null };
  });
});

describe('POST /api/admin/clients/[id]/subscription', () => {
  it('rejects a non-admin before touching Stripe', async () => {
    state.user = { email: 'someone@example.com' };
    expect((await post('sub_new')).status).toBe(401);
    expect(state.retrieve).not.toHaveBeenCalled();
  });

  it('stamps a hand-made subscription and links it, so its webhooks reach the client', async () => {
    const res = await post('sub_new');
    expect(res.status).toBe(200);
    expect(state.update).toHaveBeenCalledWith('sub_new', {
      metadata: { client_id: CLIENT_ID, plan: 'starter' },
    });
    expect(state.claimClient.mock.calls[0]?.[1]).toMatchObject({
      clientId: CLIENT_ID,
      plan: 'starter',
      stripeCustomerId: 'cus_a',
      stripeSubscriptionId: 'sub_new',
    });
    expect(state.events[0]).toMatchObject({ type: 'admin_subscription_reactivated' });
  });

  it('skips the Stripe write when the subscription is already stamped', async () => {
    state.sub = { ...state.sub, metadata: { client_id: CLIENT_ID, plan: 'starter' } };
    expect((await post('sub_new')).status).toBe(200);
    expect(state.update).not.toHaveBeenCalled();
  });

  it('changes nothing for a subscription that is not live', async () => {
    state.sub = { ...state.sub, status: 'canceled' };
    const res = await post('sub_new');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'not_live' });
    expect(state.update).not.toHaveBeenCalled();
    expect(state.claimClient).not.toHaveBeenCalled();
  });

  it('changes nothing for another platform\'s subscription', async () => {
    state.sub = { ...state.sub, metadata: { platform: 'scoopunity' } };
    expect((await post('sub_new')).status).toBe(409);
    expect(state.update).not.toHaveBeenCalled();
    expect(state.claimClient).not.toHaveBeenCalled();
  });

  it('refuses a subscription another client already holds', async () => {
    state.conflicts = [{ id: 'client-b' }];
    const res = await post('sub_new');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'other_client' });
    expect(state.update).not.toHaveBeenCalled();
  });

  it('checks a new customer against other clients, but not the client\'s own', async () => {
    await post('sub_new');
    expect(state.conflictFilter).toBe('stripe_subscription_id.eq.sub_new');

    state.conflicts = [];
    state.row = { ...state.row, stripe_customer_id: 'cus_other', stripe_subscription_id: 'sub_old' };
    await post('sub_new');
    expect(state.conflictFilter).toBe('stripe_subscription_id.eq.sub_new,stripe_customer_id.eq.cus_a');
  });

  it('refuses when no plan can be determined', async () => {
    state.row = { ...state.row, plan: null };
    const res = await post('sub_new');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'plan_unknown' });
  });

  it('does not report success when the cancellation is still on the row', async () => {
    state.claimClient.mockResolvedValue({ ownerUserId: 'owner', isUpsell: true, client: null });
    const res = await post('sub_new');
    expect(res.status).toBe(500);
    expect(state.events).toHaveLength(0);
  });

  it('reports a site that still has no owner instead of claiming success', async () => {
    state.row = { ...state.row, owner_user_id: null };
    const res = await post('sub_new');
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'no_owner' });
  });
});

describe('GET /api/admin/clients/[id]/subscription', () => {
  const listed = {
    id: 'sub_new',
    customer: 'cus_a',
    status: 'active',
    cancel_at: null,
    start_date: 1_793_000_000,
    metadata: {},
    items: {
      data: [{ quantity: 1, price: { unit_amount: 9900, currency: 'usd', recurring: { interval: 'month', interval_count: 1 } } }],
    },
  };

  function get(query = '') {
    const req = { nextUrl: new URL(`http://localhost/api${query}`) };
    return GET(req as unknown as NextRequest, context);
  }

  it('lists the stored customer\'s subscriptions, flagging the linkable one', async () => {
    state.list.mockResolvedValue({ data: [listed] });
    const res = await get();
    expect(res.status).toBe(200);
    expect(state.list).toHaveBeenCalledWith({ customer: 'cus_a', status: 'all', limit: 20 });
    const body = await res.json();
    expect(body.siteFilesPresent).toBe(true);
    expect(body.subscriptions[0]).toMatchObject({
      id: 'sub_new',
      price: '$99.00/month',
      current: false,
      blocker: null,
    });
  });

  it('looks up a pasted subscription id directly', async () => {
    state.sub = listed;
    await get('?stripe=sub_new');
    expect(state.retrieve).toHaveBeenCalledWith('sub_new');
    expect(state.list).not.toHaveBeenCalled();
  });

  it('rejects anything that is not a Stripe id', async () => {
    expect((await get('?stripe=not-an-id')).status).toBe(400);
  });

  it('reports a clean miss from Stripe', async () => {
    state.retrieve.mockRejectedValue(Object.assign(new Error('No such'), { code: 'resource_missing' }));
    const res = await get('?stripe=sub_gone');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found_in_stripe' });
  });

  it('does not call Stripe for a client with no customer', async () => {
    state.row = { ...state.row, stripe_customer_id: null };
    const res = await get();
    expect((await res.json()).subscriptions).toEqual([]);
    expect(state.list).not.toHaveBeenCalled();
  });
});
