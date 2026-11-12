import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestTenant,
  deleteTestTenant,
  serviceClient,
  type TestTenant,
  HAS_TEST_DB,
} from './helpers';

/**
 * Rate limit logic tests — these verify the DB queries used by the
 * /api/portal/request route to enforce the starter plan 3-request/month cap.
 * The cap itself is enforced in application code, not RLS.
 */
describe.skipIf(!HAS_TEST_DB)('Request rate limiting (starter plan)', () => {
  let tenant: TestTenant;

  beforeAll(async () => {
    tenant = await createTestTenant('rate-limit');
    // Force plan to starter
    const admin = serviceClient();
    await admin.from('clients').update({ plan: 'starter' }).eq('id', tenant.clientId);
  });

  afterAll(async () => {
    await deleteTestTenant(tenant);
  });

  it('counts zero requests at start of month', async () => {
    const admin = serviceClient();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count } = await admin
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', tenant.clientId)
      .gte('created_at', monthStart.toISOString());

    expect(count).toBe(0);
  });

  it('correctly counts requests inserted this month', async () => {
    const admin = serviceClient();

    const { error: insertError } = await admin.from('requests').insert([
      { client_id: tenant.clientId, source: 'portal', body: 'Request one please update hours' },
      { client_id: tenant.clientId, source: 'portal', body: 'Request two please add service' },
      { client_id: tenant.clientId, source: 'portal', body: 'Request three please swap photo' },
    ]);
    if (insertError) throw new Error(`requests insert failed: ${insertError.message}`);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count } = await admin
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', tenant.clientId)
      .gte('created_at', monthStart.toISOString());

    expect(count).toBe(3);
  });

  it('requests from a previous month are not counted in the current month cap', async () => {
    const admin = serviceClient();

    // Insert a request backdated to last month via raw update after insert
    const { data: old } = await admin
      .from('requests')
      .insert({ client_id: tenant.clientId, source: 'portal', body: 'Old request from last month' })
      .select('id')
      .single();

    if (!old) throw new Error('Failed to insert backdated request');

    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    await admin.from('requests').update({ created_at: lastMonth.toISOString() }).eq('id', old.id);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count } = await admin
      .from('requests')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', tenant.clientId)
      .gte('created_at', monthStart.toISOString());

    // Should still be 3 — the backdated one is excluded
    expect(count).toBe(3);
  });
});
