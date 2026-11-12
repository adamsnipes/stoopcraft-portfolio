import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({ inserted: [] as Record<string, unknown>[] }));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { email: 'admin@example.test' } } }) } }),
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      insert: (row: Record<string, unknown>) => {
        state.inserted.push(row);
        return { select: () => ({ single: async () => ({ data: { id: 'c1' }, error: null }) }) };
      },
    }),
  }),
}));
vi.mock('@/lib/r2/static-site', () => ({ uploadStaticBundle: vi.fn(async () => {}) }));

import { POST } from '../../apps/web/app/api/admin/static-sites/route';

async function create(brand?: string) {
  const form = new FormData();
  form.append('business_name', 'Joe Plumbing');
  form.append('slug', 'joe-plumbing');
  if (brand !== undefined) form.append('brand', brand);
  form.append('file', new File(['<html></html>'], 'index.html'));
  return POST({ formData: async () => form } as unknown as NextRequest);
}

beforeEach(() => { state.inserted = []; vi.stubEnv('ADMIN_EMAIL', 'admin@example.test'); });

describe('new static site brand', () => {
  it('creates the client under the chosen brand', async () => {
    expect((await create('stupid-cheap-websites')).status).toBe(200);
    expect(state.inserted[0]).toMatchObject({ slug: 'joe-plumbing', brand: 'stupid-cheap-websites' });
  });
  it('defaults to StoopCraft when no brand is sent', async () => {
    expect((await create()).status).toBe(200);
    expect(state.inserted[0]).toMatchObject({ brand: 'stoopcraft' });
  });
  it('rejects an unknown brand before creating anything', async () => {
    const res = await create('acme');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_brand' });
    expect(state.inserted).toHaveLength(0);
  });
});
