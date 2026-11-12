import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  client: null as null | Record<string, unknown>,
  checkout: vi.fn(async (_opts: Record<string, unknown>) => 'https://checkout.stripe.com/c/pay/cs_test_1'),
}));
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: state.client }) }) }) }),
  }),
}));
vi.mock('@/lib/stripe', () => ({ createCheckoutSession: state.checkout }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => ({ allowed: true }), clientIpFromHeaders: () => '1.2.3.4' }));
vi.mock('@/lib/turnstile', () => ({ checkHoneypot: () => ({ ok: true }) }));
vi.mock('@/lib/funnel-log', () => ({ logFunnel: () => {}, alertRateLimit: () => {}, requestIdFromHeaders: () => 'req', geoFromHeaders: () => ({}) }));

import { POST } from '../../apps/web/app/api/pay/[id]/route';

const ID = '0b5f1c3e-1d2a-4c8e-9f00-123456789abc';
async function pay(plan: string) {
  const req = { headers: new Headers(), json: async () => ({ plan }) } as unknown as NextRequest;
  return POST(req, { params: Promise.resolve({ id: ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('PLATFORM_DOMAIN', 'stoopcraft.com');
});

describe('pay API keeps each brand on its own plan and domain', () => {
  it('charges a Stupid Cheap Websites client the $40 plan with brand-domain return URLs', async () => {
    state.client = { id: ID, status: 'live', owner_user_id: null, brand: 'stupid-cheap-websites' };
    expect((await pay('scw')).status).toBe(200);
    const opts = state.checkout.mock.calls[0]?.[0];
    expect(opts).toMatchObject({ plan: 'scw', successUrl: 'https://stupidcheapwebsites.com/welcome?session_id={CHECKOUT_SESSION_ID}', cancelUrl: `https://stupidcheapwebsites.com/pay/${ID}` });
  });
  it.each([
    [{ brand: 'stupid-cheap-websites' }, 'starter'],
    [{ brand: 'stoopcraft' }, 'scw'],
  ])('refuses a plan from the other brand (%o, %s)', async (brand, plan) => {
    state.client = { id: ID, status: 'live', owner_user_id: null, ...brand };
    const res = await pay(plan);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'plan_brand_mismatch' });
    expect(state.checkout).not.toHaveBeenCalled();
  });
  it('leaves StoopCraft checkout on stoopcraft.com', async () => {
    state.client = { id: ID, status: 'live', owner_user_id: null, brand: 'stoopcraft' };
    expect((await pay('starter')).status).toBe(200);
    expect(state.checkout.mock.calls[0]?.[0]).toMatchObject({ plan: 'starter', successUrl: 'https://stoopcraft.com/welcome?session_id={CHECKOUT_SESSION_ID}' });
  });
});
