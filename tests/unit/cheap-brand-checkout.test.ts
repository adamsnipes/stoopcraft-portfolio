import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.hoisted(() => vi.fn(async (_params: Record<string, unknown>) => ({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' })));
// Mock by the path apps/web resolves 'stripe' to (pnpm store), since the test
// file sits outside apps/web and would otherwise resolve a different id.
vi.mock(import.meta.resolve('stripe', new URL('../../apps/web/', import.meta.url).href), () => ({ default: class { checkout = { sessions: { create } }; } }));

import { createCheckoutSession } from '../../apps/web/lib/stripe';

beforeEach(() => {
  create.mockClear();
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x');
  vi.stubEnv('STRIPE_SCW_PRICE_ID', 'price_scw');
  vi.stubEnv('STRIPE_STARTER_PRICE_ID', 'price_starter');
});

const base = { clientId: 'c1', successUrl: 'https://x/s', cancelUrl: 'https://x/c' };

describe('Checkout branding per brand', () => {
  it('rebrands the $40 plan as Stupid Cheap Websites without a platform tag', async () => {
    await createCheckoutSession({ ...base, plan: 'scw' });
    const params = create.mock.calls[0]?.[0] as Record<string, any>;
    expect(params.line_items).toEqual([{ price: 'price_scw', quantity: 1 }]);
    expect(params.branding_settings.display_name).toBe('Stupid Cheap Websites');
    expect(params.metadata.platform).toBeUndefined();
    expect(params.subscription_data.metadata).toMatchObject({ client_id: 'c1', plan: 'scw' });
  });
  it('leaves StoopCraft checkout unbranded', async () => {
    await createCheckoutSession({ ...base, plan: 'starter' });
    expect((create.mock.calls[0]?.[0] as Record<string, unknown>).branding_settings).toBeUndefined();
  });
});
