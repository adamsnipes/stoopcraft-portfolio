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

describe.skipIf(!HAS_TEST_DB)('Tenant Isolation: photos table', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let photoAId: string;
  let photoBId: string;

  beforeAll(async () => {
    tenantA = await createTestTenant('photos-a');
    tenantB = await createTestTenant('photos-b');

    const admin = serviceClient();

    // Insert one photo per tenant
    const { data: pa } = await admin
      .from('photos')
      .insert({
        client_id: tenantA.clientId,
        r2_key: `clients/${tenantA.clientId}/test-photo-a.jpg`,
        position: 0,
        source: 'fallback',
      })
      .select('id')
      .single();

    const { data: pb } = await admin
      .from('photos')
      .insert({
        client_id: tenantB.clientId,
        r2_key: `clients/${tenantB.clientId}/test-photo-b.jpg`,
        position: 0,
        source: 'fallback',
      })
      .select('id')
      .single();

    if (!pa || !pb) throw new Error('Failed to insert test photos');
    photoAId = pa.id;
    photoBId = pb.id;
  });

  afterAll(async () => {
    await deleteTestTenant(tenantA);
    await deleteTestTenant(tenantB);
  });

  it('User A cannot SELECT photos belonging to Client B', async () => {
    const supabase = authedClient(tenantA.accessToken);
    const { data } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoBId)
      .maybeSingle();

    expect(data).toBeNull();
  });

  it('Anon cannot SELECT photos for pre-sale clients', async () => {
    const admin = serviceClient();
    const slug = `test-presale-photos-${Math.random().toString(36).slice(2, 8)}`;
    const { data: preSale } = await admin
      .from('clients')
      .insert({
        slug,
        status: 'live',
        niche: 'barber',
        business_name: 'Pre-Sale Photos Test',
        city: 'Brooklyn',
        state: 'NY',
      })
      .select('id')
      .single();
    if (!preSale) throw new Error('Failed to create pre-sale client');

    const { data: preSalePhoto } = await admin
      .from('photos')
      .insert({
        client_id: preSale.id,
        r2_key: `clients/${preSale.id}/secret.jpg`,
        position: 0,
        source: 'fallback',
      })
      .select('id')
      .single();
    if (!preSalePhoto) throw new Error('Failed to create pre-sale photo');

    const anon = anonClient();
    const { data } = await anon
      .from('photos')
      .select('*')
      .eq('id', preSalePhoto.id)
      .maybeSingle();

    expect(data).toBeNull();

    await admin.from('clients').delete().eq('id', preSale.id);
  });

  it('Anon CAN SELECT photos for claimed clients', async () => {
    const anon = anonClient();
    const { data } = await anon
      .from('photos')
      .select('id, r2_key')
      .eq('id', photoAId)
      .maybeSingle();

    expect(data).not.toBeNull();
    expect(data?.id).toBe(photoAId);
  });

  it('User A can SELECT their own photos', async () => {
    const supabase = authedClient(tenantA.accessToken);
    const { data } = await supabase
      .from('photos')
      .select('id')
      .eq('id', photoAId)
      .single();

    expect(data?.id).toBe(photoAId);
  });
});
