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

describe.skipIf(!HAS_TEST_DB)('Tenant Isolation: content table', () => {
  let tenantA: TestTenant;
  let tenantB: TestTenant;

  beforeAll(async () => {
    tenantA = await createTestTenant('content-a');
    tenantB = await createTestTenant('content-b');
  });

  afterAll(async () => {
    await deleteTestTenant(tenantA);
    await deleteTestTenant(tenantB);
  });

  it('User A cannot SELECT content belonging to Client B', async () => {
    const supabase = authedClient(tenantA.accessToken);
    const { data } = await supabase
      .from('content')
      .select('*')
      .eq('client_id', tenantB.clientId)
      .maybeSingle();

    expect(data).toBeNull();
  });

  it('User A cannot UPDATE content belonging to Client B', async () => {
    const supabase = authedClient(tenantA.accessToken);
    const { data } = await supabase
      .from('content')
      .update({ hero_headline: 'HACKED' })
      .eq('id', tenantB.contentId)
      .select();

    expect(data).toHaveLength(0);

    // Verify unchanged
    const admin = serviceClient();
    const { data: check } = await admin
      .from('content')
      .select('hero_headline')
      .eq('id', tenantB.contentId)
      .single();
    expect(check?.hero_headline).not.toBe('HACKED');
  });

  it('Anon cannot SELECT content for pre-sale clients', async () => {
    const admin = serviceClient();
    // Create pre-sale client + content
    const slug = `test-presale-content-${Math.random().toString(36).slice(2, 8)}`;
    const { data: preSale } = await admin
      .from('clients')
      .insert({
        slug,
        status: 'live',
        niche: 'barber',
        business_name: 'Pre-Sale Content Test',
        city: 'Brooklyn',
        state: 'NY',
      })
      .select('id')
      .single();
    if (!preSale) throw new Error('Failed to create pre-sale client');

    const { data: preSaleContent } = await admin
      .from('content')
      .insert({
        client_id: preSale.id,
        version: 1,
        is_published: true,
        hero_headline: 'Secret Pre-Sale Content',
      })
      .select('id')
      .single();
    if (!preSaleContent) throw new Error('Failed to create pre-sale content');

    const anon = anonClient();
    const { data } = await anon
      .from('content')
      .select('*')
      .eq('id', preSaleContent.id)
      .maybeSingle();

    expect(data).toBeNull();

    // Cleanup
    await admin.from('clients').delete().eq('id', preSale.id);
  });

  it('Anon CAN SELECT published content for claimed clients', async () => {
    const anon = anonClient();
    const { data } = await anon
      .from('content')
      .select('id, hero_headline')
      .eq('id', tenantA.contentId)
      .maybeSingle();

    expect(data).not.toBeNull();
    expect(data?.id).toBe(tenantA.contentId);
  });

  it('User can SELECT their own content', async () => {
    const supabase = authedClient(tenantA.accessToken);
    const { data } = await supabase
      .from('content')
      .select('id')
      .eq('id', tenantA.contentId)
      .single();

    expect(data?.id).toBe(tenantA.contentId);
  });
});
