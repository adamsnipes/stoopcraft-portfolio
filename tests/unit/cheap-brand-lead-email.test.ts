import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createServiceRoleClient: () => ({}) }));
import { sendCheapBrandLeadEmail } from '../../apps/web/lib/email/cheap-brand';

const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('{"id":"em_1"}', { status: 200 }));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('brand client lead email', () => {
  it('sends from the brand account with the lead escaped into the table', async () => {
    vi.stubEnv('RESEND_API_KEY_CHEAP', 'test-cheap');
    await sendCheapBrandLeadEmail({ to: 'joe@example.test', businessName: 'Joe\'s Plumbing', lead: { name: 'Pat', phone: '555', message: '<b>hi</b>' } });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('api.resend.com');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-cheap');
    const body = JSON.parse(String(init?.body));
    expect(body.from).toBe('Stupid Cheap Websites <hello@stupidcheapwebsites.com>');
    expect(body.html).toContain('&lt;b&gt;hi&lt;/b&gt;');
    expect(JSON.stringify(body).toLowerCase()).not.toContain('stoop');
  });
  it('refuses to send without the brand key instead of using StoopCraft\'s', async () => {
    vi.stubEnv('RESEND_API_KEY_CHEAP', '');
    vi.stubEnv('RESEND_API_KEY', 'stoop-key');
    await expect(sendCheapBrandLeadEmail({ to: 'joe@example.test', businessName: 'Joe', lead: { name: 'Pat', message: 'x' } })).rejects.toThrow('RESEND_API_KEY_CHEAP');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
