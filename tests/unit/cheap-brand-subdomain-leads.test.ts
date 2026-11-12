import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

// Records every .eq() the contact route applies, and returns state.client.
const state = vi.hoisted(() => ({
  client: null as null | Record<string, unknown>,
  filters: [] as [string, unknown][],
  brandLead: vi.fn(async (_opts: Record<string, unknown>) => ({ id: 'em_1' })),
  provider: vi.fn(async (_opts: Record<string, unknown>) => ({ id: 'em_2' })),
}));
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => {
    const query = {
      eq: (col: string, value: unknown) => { state.filters.push([col, value]); return query; },
      single: async () => ({ data: state.client }),
    };
    return {
      from: () => ({ select: () => query }),
      auth: { admin: { getUserById: async () => ({ data: { user: { email: 'owner@example.test' } } }) } },
    };
  },
}));
vi.mock('@/lib/email/cheap-brand', () => ({ sendCheapBrandLeadEmail: state.brandLead }));
vi.mock('@/lib/email', () => ({
  getEmailProvider: () => ({ send: state.provider }),
  escapeHtml: (v: string) => v,
  renderTemplate: () => ({ subject: '', html: '' }),
}));
vi.mock('@/lib/sms', () => ({ sendSms: vi.fn(), normalizeUsPhone: () => null, isSmsConfigured: () => false }));

import { POST } from '../../apps/web/app/api/contact/route';

async function lead(siteHost: string) {
  const req = {
    headers: new Headers({ host: 'stupidcheapwebsites.com' }),
    json: async () => ({ name: 'Pat Lead', phone: '5550100', source: 'contact_form', message: 'Need a quote', site_host: siteHost, website: '' }),
  } as unknown as NextRequest;
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.filters = [];
  vi.stubEnv('PLATFORM_DOMAIN', 'stoopcraft.com');
});

describe('leads from brand client subdomains', () => {
  it('resolves <slug>.stupidcheapwebsites.com only among brand clients', async () => {
    state.client = null;
    expect((await lead('joes-plumbing.stupidcheapwebsites.com')).status).toBe(404);
    expect(state.filters).toEqual([['slug', 'joes-plumbing'], ['brand', 'stupid-cheap-websites']]);
  });
  it('emails a brand client\'s lead through the brand account, never the StoopCraft provider', async () => {
    state.client = { id: 'c1', slug: 'joes-plumbing', business_name: 'Joe\'s Plumbing', custom_domain: null, owner_user_id: 'u1', status: 'claimed', notification_email: null, brand: 'stupid-cheap-websites' };
    expect((await lead('joes-plumbing.stupidcheapwebsites.com')).status).toBe(200);
    expect(state.brandLead).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@example.test', businessName: 'Joe\'s Plumbing', lead: expect.objectContaining({ name: 'Pat Lead', message: 'Need a quote' }) }));
    expect(state.provider).not.toHaveBeenCalled();
  });
  it('keeps StoopCraft subdomain leads on the StoopCraft provider', async () => {
    state.client = { id: 'c2', slug: 'acme', business_name: 'Acme Co', custom_domain: null, owner_user_id: 'u2', status: 'claimed', notification_email: null, brand: 'stoopcraft' };
    expect((await lead('acme.stoopcraft.com')).status).toBe(200);
    expect(state.filters).toEqual([['slug', 'acme']]);
    expect(state.provider).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'c2', template: 'contact_form_lead' }));
    expect(state.brandLead).not.toHaveBeenCalled();
  });
});
