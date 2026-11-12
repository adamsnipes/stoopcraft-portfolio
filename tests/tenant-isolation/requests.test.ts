import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestTenant,
  deleteTestTenant,
  authedClient,
  serviceClient,
  type TestTenant,
  HAS_TEST_DB,
} from './helpers';

describe.skipIf(!HAS_TEST_DB)('Tenant Isolation: requests table', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let requestAId: string;

  beforeAll(async () => {
    tenantA = await createTestTenant('requests-a');
    tenantB = await createTestTenant('requests-b');

    // Insert a request for tenant A via service role
    const admin = serviceClient();
    const { data } = await admin
      .from('requests')
      .insert({
        client_id: tenantA.clientId,
        source: 'portal',
        body: 'Please update my hours.',
      })
      .select('id')
      .single();
    if (!data) throw new Error('Failed to insert test request');
    requestAId = data.id;
  });

  afterAll(async () => {
    await deleteTestTenant(tenantA);
    await deleteTestTenant(tenantB);
  });

  it('User A cannot SELECT requests belonging to Client B (empty result)', async () => {
    const supabase = authedClient(tenantA.accessToken);
    const { data } = await supabase
      .from('requests')
      .select('*')
      .eq('client_id', tenantB.clientId);

    expect(data).toHaveLength(0);
  });

  it('User B cannot SELECT the specific request from Client A', async () => {
    const supabase = authedClient(tenantB.accessToken);
    const { data } = await supabase
      .from('requests')
      .select('*')
      .eq('id', requestAId)
      .maybeSingle();

    expect(data).toBeNull();
  });

  it('User B cannot INSERT a request for Client A', async () => {
    const supabase = authedClient(tenantB.accessToken);
    const { data, error } = await supabase
      .from('requests')
      .insert({
        client_id: tenantA.clientId, // B trying to insert for A
        source: 'portal',
        body: 'Malicious request',
      })
      .select();

    // RLS insert check should prevent this — either 0 rows or an error
    const inserted = data?.length ?? 0;
    expect(inserted).toBe(0);
    void error;
  });

  it('User A can INSERT a request for their own client', async () => {
    const supabase = authedClient(tenantA.accessToken);
    const { data, error } = await supabase
      .from('requests')
      .insert({
        client_id: tenantA.clientId,
        source: 'portal',
        body: 'Legitimate request from owner A',
      })
      .select('id');

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('User A can SELECT their own requests', async () => {
    const supabase = authedClient(tenantA.accessToken);
    const { data } = await supabase
      .from('requests')
      .select('id')
      .eq('client_id', tenantA.clientId);

    expect((data?.length ?? 0)).toBeGreaterThan(0);
  });
});
