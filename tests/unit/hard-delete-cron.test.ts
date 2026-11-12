import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  clients: [] as Record<string, unknown>[],
  events: [] as Record<string, unknown>[],
  deletedRows: [] as string[],
  list: vi.fn(),
  r2Send: vi.fn(),
  deleteStaticBundle: vi.fn(),
  removeDomainFromVercel: vi.fn(),
  sendAdminAlert: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
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
        select: () => ({ lt: () => ({ not: async () => ({ data: state.clients, error: null }) }) }),
        delete: () => ({
          eq: async (_column: string, id: string) => {
            state.deletedRows.push(id);
            return {};
          },
        }),
      };
    },
  }),
}));

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({ subscriptions: { list: state.list } }),
}));
vi.mock('@/lib/email', () => ({ sendAdminAlert: state.sendAdminAlert }));
vi.mock('@/lib/r2/static-site', () => ({ deleteStaticBundle: state.deleteStaticBundle }));
vi.mock('@/lib/vercel/domains', () => ({ removeDomainFromVercel: state.removeDomainFromVercel }));
// Only installed under apps/web, so the mock has to name that copy.
vi.mock('../../apps/web/node_modules/@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = state.r2Send;
  },
  ListObjectsV2Command: class {},
  DeleteObjectsCommand: class {},
}));

import { GET } from '../../apps/web/app/api/cron/hard-delete/route';

function client(id: string, stripe_customer_id: string | null = `cus_${id}`) {
  return {
    id,
    business_name: `Client <${id}>`,
    slug: id,
    custom_domain: null,
    domain_owner: null,
    stripe_customer_id,
  };
}

async function run() {
  const req = { headers: new Headers({ authorization: 'Bearer secret' }) };
  const res = await GET(req as unknown as NextRequest);
  return res.json();
}

beforeEach(() => {
  process.env.CRON_SECRET = 'secret';
  state.clients = [];
  state.events = [];
  state.deletedRows = [];
  state.list.mockReset().mockResolvedValue({ data: [] });
  state.r2Send.mockReset().mockResolvedValue({ Contents: [], IsTruncated: false });
  state.deleteStaticBundle.mockReset();
  state.removeDomainFromVercel.mockReset();
  state.sendAdminAlert.mockReset().mockResolvedValue(undefined);
});

function expectNothingDeleted() {
  expect(state.deletedRows).toEqual([]);
  expect(state.r2Send).not.toHaveBeenCalled();
  expect(state.deleteStaticBundle).not.toHaveBeenCalled();
  expect(state.events.map((e) => e['type'])).not.toContain('hard_delete_cron');
}

describe('hard-delete cron Stripe check', () => {
  // The bug: a client reactivated by hand in Stripe keeps its old hard_delete_at.
  it('never deletes a client with a live subscription, and alerts instead', async () => {
    state.clients = [client('paying')];
    state.list.mockResolvedValue({
      data: [
        { id: 'sub_old', status: 'canceled' },
        { id: 'sub_new', status: 'active' },
      ],
    });
    const body = await run();
    expect(body).toMatchObject({ deleted: 0, failed: 0, skipped: 1 });
    expectNothingDeleted();
    expect(state.events[0]).toMatchObject({ client_id: 'paying', type: 'hard_delete_skipped' });
    const alert = state.sendAdminAlert.mock.calls[0]?.[0];
    expect(alert.html).toContain('/admin/clients/paying/billing');
    expect(alert.html).toContain('sub_new');
    expect(alert.html).not.toContain('sub_old');
  });

  it('treats every billing status as live', async () => {
    for (const status of ['active', 'trialing', 'past_due']) {
      state.clients = [client('c')];
      state.list.mockResolvedValue({ data: [{ id: 'sub', status }] });
      expect((await run()).skipped).toBe(1);
    }
    expectNothingDeleted();
  });

  // An outage must not turn into a permanent loss.
  it('does not delete when Stripe cannot be reached', async () => {
    state.clients = [client('unknown')];
    state.list.mockRejectedValue(new Error('Stripe is down'));
    const body = await run();
    expect(body).toMatchObject({ deleted: 0, skipped: 1 });
    expectNothingDeleted();
    expect(state.sendAdminAlert.mock.calls[0]?.[0].html).toContain('Stripe is down');
  });

  it('still deletes a client whose subscriptions have all ended', async () => {
    state.clients = [client('gone')];
    state.list.mockResolvedValue({ data: [{ id: 'sub_old', status: 'canceled' }] });
    const body = await run();
    expect(body).toMatchObject({ deleted: 1, skipped: 0 });
    expect(state.deletedRows).toEqual(['gone']);
    expect(state.deleteStaticBundle).toHaveBeenCalledWith('gone');
    expect(state.sendAdminAlert).not.toHaveBeenCalled();
  });

  it('still deletes a client with no Stripe customer, without calling Stripe', async () => {
    state.clients = [client('cash', null)];
    expect((await run()).deleted).toBe(1);
    expect(state.list).not.toHaveBeenCalled();
  });

  // Otherwise a removed customer would block the deletion and alert forever.
  it('still deletes when Stripe says the customer does not exist', async () => {
    state.clients = [client('removed')];
    state.list.mockRejectedValue(Object.assign(new Error('No such customer'), { code: 'resource_missing' }));
    expect((await run()).deleted).toBe(1);
    expect(state.sendAdminAlert).not.toHaveBeenCalled();
  });

  it('handles each client on its own and sends one alert', async () => {
    state.clients = [client('gone'), client('paying'), client('paying-too')];
    state.list.mockImplementation(async ({ customer }: { customer: string }) => ({
      data: customer === 'cus_gone' ? [] : [{ id: 'sub', status: 'active' }],
    }));
    const body = await run();
    expect(body).toMatchObject({ deleted: 1, skipped: 2 });
    expect(state.deletedRows).toEqual(['gone']);
    expect(state.sendAdminAlert).toHaveBeenCalledTimes(1);
    expect(state.sendAdminAlert.mock.calls[0]?.[0].subject).toBe('Hard delete skipped for 2 clients');
  });

  it('escapes business names in the alert', async () => {
    state.clients = [client('paying')];
    state.list.mockResolvedValue({ data: [{ id: 'sub', status: 'active' }] });
    await run();
    expect(state.sendAdminAlert.mock.calls[0]?.[0].html).toContain('Client &lt;paying&gt;');
  });

  it('finishes the run when the alert email fails', async () => {
    state.clients = [client('paying')];
    state.list.mockResolvedValue({ data: [{ id: 'sub', status: 'active' }] });
    state.sendAdminAlert.mockRejectedValue(new Error('Resend down'));
    expect((await run()).success).toBe(true);
    expectNothingDeleted();
  });
});
