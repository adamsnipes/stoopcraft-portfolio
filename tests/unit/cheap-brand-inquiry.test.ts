import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({ jobs: [] as (() => Promise<unknown>)[], capi: vi.fn() }));
vi.mock('@/lib/meta', () => ({ sendLeadCapiEvent: state.capi }));
vi.mock('@/lib/email', () => ({ escapeHtml: (value: string) => value.replaceAll('<', '&lt;').replaceAll('>', '&gt;') }));

import { POST } from '../../apps/web/app/api/agency-inquiry/route';

// Use the actual response class; only after() needs a request-context stub.
vi.mock('../../apps/web/node_modules/next/server.js', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, after: (job: () => Promise<unknown>) => { state.jobs.push(job); } };
});

const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{}', { status: 200 }));
function payloadFor(host: string) {
  // The internal lead alert is the Resend call addressed to the team inbox.
  const call = fetchMock.mock.calls.find(([url, init]) => host === 'crm' ? typeof JSON.parse(String(init?.body ?? '{}')).quoteAmount === 'number' : String(url).includes(host) && !String(init?.body).includes('"to":"owner@example.test"'));
  expect(call).toBeDefined();
  return JSON.parse(call?.[1]?.body as string);
}
beforeEach(() => {
  state.jobs = [];
  vi.clearAllMocks();
  vi.stubEnv('RESEND_API_KEY', 'test-only');
  vi.stubEnv('RESEND_API_KEY_CHEAP', 'test-cheap');
  vi.stubEnv('SECUREMYLEAD_WEBHOOK_URL', 'https://crm.example.test/leads');
  vi.stubEnv('SECUREMYLEAD_WEBHOOK_URL_CHEAP', 'https://crm.example.test/cheap-leads');
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function post(extra: Record<string, unknown> = {}) {
  const req = { json: async () => ({ name: 'Test Owner', business_name: 'Test Business', email: 'owner@example.test', ...extra }) } as unknown as NextRequest;
  const response = await POST(req);
  await Promise.all(state.jobs.map(job => job()));
  return response;
}

describe('marketing offer attribution without changing existing pricing', () => {
  it('tags the $40 brand in the existing email and CRM, with the correct deal value', async () => {
    expect((await post({ brand: 'stupid-cheap-websites' })).status).toBe(200);
    const payload = payloadFor('crm');
    expect(payload.quoteAmount).toBe(40);
    expect(payload.notes).toContain('Source brand: Stupid Cheap Websites');
    expect(payload.notes).toContain('Offer: $40/month');
    expect(payloadFor('api.resend.com').subject).toContain('[Stupid Cheap Websites · $40/mo]');
  });
  it('sends the lead a confirmation from the brand account, never StoopCraft', async () => {
    await post({ brand: 'stupid-cheap-websites' });
    const call = fetchMock.mock.calls.find(([url, init]) => String(url).includes('api.resend.com') && String(init?.body).includes('"to":"owner@example.test"'));
    expect(call).toBeDefined();
    const body = JSON.parse(call?.[1]?.body as string);
    expect(new Headers(call?.[1]?.headers).get('authorization')).toBe('Bearer test-cheap');
    expect(body.from).toBe('Stupid Cheap Websites <hello@stupidcheapwebsites.com>');
    expect([body.reply_to].flat()).toContain('hello@stupidcheapwebsites.com');
    expect(body.text).toContain('Hey Test, Stupid Cheap Websites here - we got your request to build your website.');
    expect(body.text).toContain("We're only accepting a handful of applicants, so please let us know at your earliest convenience.");
    expect(body.html).toContain('handful of applicants');
    expect(JSON.stringify(body).toLowerCase()).not.toContain('stoop');
  });
  it('alerts the brand team inbox through the brand account', async () => {
    await post({ brand: 'stupid-cheap-websites' });
    const cheap = fetchMock.mock.calls.find(([url, init]) => String(url).includes('api.resend.com') && String(init?.body).includes('"to":"developer@example.com"'));
    expect(cheap).toBeDefined();
    expect(new Headers(cheap?.[1]?.headers).get('authorization')).toBe('Bearer test-cheap');
    expect(JSON.parse(cheap?.[1]?.body as string).from).toBe('Stupid Cheap Websites <hello@stupidcheapwebsites.com>');
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes('api.resend.com') && new Headers(init?.headers).get('authorization') === 'Bearer test-only')).toBe(false);
    fetchMock.mockClear(); state.jobs = [];
    await post();
    const stoop = fetchMock.mock.calls.find(([url, init]) => String(url).includes('api.resend.com') && String(init?.body).includes('"to":"leads@example.com"'));
    expect(new Headers(stoop?.[1]?.headers).get('authorization')).toBe('Bearer test-only');
  });
  it('sends StoopCraft leads an auto-reply from the StoopCraft account only', async () => {
    vi.stubEnv('RESEND_FROM_EMAIL', 'notifications@stoopcraft.com');
    vi.stubEnv('REPLY_TO_EMAIL', 'team@stoopcraft.test');
    await post();
    const call = fetchMock.mock.calls.find(([url, init]) => String(url).includes('api.resend.com') && String(init?.body).includes('"to":"owner@example.test"'));
    expect(call).toBeDefined();
    const body = JSON.parse(call?.[1]?.body as string);
    expect(new Headers(call?.[1]?.headers).get('authorization')).toBe('Bearer test-only');
    expect(body.from).toBe('StoopCraft <notifications@stoopcraft.com>');
    expect([body.reply_to].flat()).toContain('team@stoopcraft.test');
    expect(body.text).toContain('Hey Test, we got your request to build your website.');
    expect(body.text).not.toContain('handful of applicants');
    expect(JSON.stringify(body).toLowerCase()).not.toMatch(/stupid|cheap/);
  });
  it('never falls back to the other brand account when a brand key is missing', async () => {
    vi.stubEnv('RESEND_API_KEY_CHEAP', '');
    await post({ brand: 'stupid-cheap-websites' });
    const toLead = fetchMock.mock.calls.filter(([url, init]) => String(url).includes('api.resend.com') && String(init?.body).includes('"to":"owner@example.test"'));
    expect(toLead).toHaveLength(0);
  });
  it.each([[{ brand: 'stupid-cheap-websites' }, 'https://crm.example.test/cheap-leads'], [{}, 'https://crm.example.test/leads']])('routes each brand to its own CRM webhook (%o)', async (extra, url) => {
    await post(extra);
    const crmCalls = fetchMock.mock.calls.filter(([u]) => String(u).startsWith('https://crm.example.test/'));
    expect(crmCalls.map(([u]) => String(u))).toEqual([url]);
  });
  it('skips the CRM for the $40 brand when its webhook is unset, never using StoopCraft\'s', async () => {
    vi.stubEnv('SECUREMYLEAD_WEBHOOK_URL_CHEAP', '');
    await post({ brand: 'stupid-cheap-websites' });
    expect(fetchMock.mock.calls.filter(([u]) => String(u).startsWith('https://crm.example.test/') || String(u).includes('securemylead'))).toHaveLength(0);
  });
  it('does not forward StoopCraft leads when its CRM webhook is unconfigured', async () => {
    vi.stubEnv('SECUREMYLEAD_WEBHOOK_URL', '');
    expect((await post()).status).toBe(200);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('crm.example.test') || String(u).includes('securemylead'))).toHaveLength(0);
  });
  it('preserves $99 for an existing form without a brand field', async () => {
    expect((await post()).status).toBe(200);
    const payload = payloadFor('crm');
    expect(payload.quoteAmount).toBe(99);
    expect(payloadFor('api.resend.com').subject).toBe('New free-website lead — Test Business');
    // One internal alert + one StoopCraft auto-reply.
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('api.resend.com'))).toHaveLength(2);
  });
  it('does not dispatch honeypot submissions or unrecognized brand values', async () => {
    expect((await post({ company_site: 'spam' })).status).toBe(200);
    expect(state.jobs).toHaveLength(0);
    expect((await post({ brand: 'unknown' })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
