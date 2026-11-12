import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestTenant,
  deleteTestTenant,
  authedClient,
  anonClient,
  serviceClient,
  type TestTenant,
  HAS_TEST_DB,
} from './helpers';

describe.skipIf(!HAS_TEST_DB)('Tenant Isolation: clients table', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;

  beforeAll(async () => {
    tenantA = await createTestTenant('clients-a');
    tenantB = await createTestTenant('clients-b');
  });

  afterAll(async () => {
    await deleteTestTenant(tenantA);
    await deleteTestTenant(tenantB);
  });

  it('User A cannot SELECT Client B using authenticated client', async () => {
    const supabase = authedClient(tenantA.accessToken);
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', tenantB.clientId)
      .maybeSingle();

    expect(data).toBeNull();
  });

  it('User B cannot SELECT Client A using authenticated client', async () => {
    const supabase = authedClient(tenantB.accessToken);
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('id', tenantA.clientId)
      .maybeSingle();

    expect(data).toBeNull();
  });

  it('User A cannot UPDATE Client B', async () => {
    const supabase = authedClient(tenantA.accessToken);
    const { data, error } = await supabase
      .from('clients')
      .update({ business_name: 'HACKED' })
      .eq('id', tenantB.clientId)
      .select();

    // RLS returns 0 rows affected, not an error — but no rows must have changed
    expect(data).toHaveLength(0);

    // Verify the actual DB value is unchanged
    const admin = serviceClient();
    const { data: check } = await admin
      .from('clients')
      .select('business_name')
      .eq('id', tenantB.clientId)
      .single();
    expect(check?.business_name).not.toBe('HACKED');
    void error; // suppress unused warning
  });

  it('Anon cannot SELECT draft/pre-sale clients (status=live, no owner)', async () => {
    const admin = serviceClient();
    // Insert a pre-sale client (status=live, owner_user_id=null)
    const slug = `test-presale-${Math.random().toString(36).slice(2, 8)}`;
    const { data: preSale } = await admin
      .from('clients')
      .insert({
        slug,
        status: 'live',
        niche: 'barber',
        business_name: 'Pre-Sale Test',
        city: 'Brooklyn',
        state: 'NY',
      })
      .select('id')
      .single();

    if (!preSale) throw new Error('Failed to create pre-sale client');

    const anon = anonClient();
    const { data } = await anon
      .from('clients')
      .select('*')
      .eq('id', preSale.id)
      .maybeSingle();

    expect(data).toBeNull();

    // Cleanup
    await admin.from('clients').delete().eq('id', preSale.id);
  });

  it('Anon cannot SELECT pre-sale client even after owner_user_id is set (claimed-but-not-subscribed state)', async () => {
    // Regression test: when a user clicks the claim magic link but hasn't paid yet,
    // owner_user_id is set but status stays 'live'. Anon must not be able to read it.
    const admin = serviceClient();
    const slug = `test-claimed-live-${Math.random().toString(36).slice(2, 8)}`;
    const { data: preSale } = await admin
      .from('clients')
      .insert({
        slug,
        status: 'live',
        niche: 'barber',
        business_name: 'Claimed But Unpaid Test',
        city: 'Brooklyn',
        state: 'NY',
        owner_user_id: tenantA.userId,
      })
      .select('id')
      .single();

    if (!preSale) throw new Error('Failed to create pre-sale client');

    const anon = anonClient();
    const { data } = await anon
      .from('clients')
      .select('*')
      .eq('id', preSale.id)
      .maybeSingle();

    expect(data).toBeNull();

    await admin.from('clients').delete().eq('id', preSale.id);
  });

  it('Anon CAN SELECT claimed clients (status=claimed, owner present)', async () => {
    const anon = anonClient();
    const { data } = await anon
      .from('clients')
      .select('id, slug, status')
      .eq('id', tenantA.clientId)
      .maybeSingle();

    // RLS allows reading claimed clients with an owner
    expect(data).not.toBeNull();
    expect(data?.status).toBe('claimed');
  });

  it('Anon cannot SELECT cancelled clients', async () => {
    const admin = serviceClient();
    await admin
      .from('clients')
      .update({ cancelled_at: new Date().toISOString() })
      .eq('id', tenantA.clientId);

    const anon = anonClient();
    const { data } = await anon
      .from('clients')
      .select('*')
      .eq('id', tenantA.clientId)
      .maybeSingle();

    expect(data).toBeNull();

    // Restore
    await admin
      .from('clients')
      .update({ cancelled_at: null })
      .eq('id', tenantA.clientId);
  });

  it('User can SELECT their own client', async () => {
    const supabase = authedClient(tenantA.accessToken);
    const { data } = await supabase
      .from('clients')
      .select('id')
      .eq('id', tenantA.clientId)
      .single();

    expect(data?.id).toBe(tenantA.clientId);
  });
});
