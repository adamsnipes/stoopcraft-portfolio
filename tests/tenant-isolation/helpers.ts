import { createClient } from '@supabase/supabase-js';
import type { Database, ClientInsert, ContentInsert } from '@dfy/db';

// Require dedicated TEST_SUPABASE_* vars — never use the production URL for tests.
// Set these in .env.test.local pointing at a local Supabase instance or a
// dedicated test project. See .env.test.local.example for the required keys.
const SUPABASE_URL = process.env.TEST_SUPABASE_URL ?? '';
const ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY ?? '';
const SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? '';

/** True only when dedicated test DB credentials are present. */
export const HAS_TEST_DB = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);

/** Service role client — bypasses RLS. Test setup only. */
export function serviceClient() {
  return createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Anon client — used to simulate unauthenticated browser requests. */
export function anonClient() {
  return createClient<Database>(SUPABASE_URL, ANON_KEY);
}

/** Authenticated client for a specific user token. */
export function authedClient(accessToken: string) {
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY);
  // We set the session directly. In tests, access_token is from email/password sign-in.
  void client.auth.setSession({ access_token: accessToken, refresh_token: 'unused' });
  return client;
}

export type TestTenant = {
  clientId: string;
  userId: string;
  accessToken: string;
  slug: string;
  contentId: string;
};

/**
 * Create a fully-formed test tenant: auth user + client + published content.
 * Uses service role for setup, then returns the user's access token for tests.
 */
export async function createTestTenant(suffix: string): Promise<TestTenant> {
  const admin = serviceClient();
  const email = `test-${suffix}@test-tenant-isolation.invalid`;
  const password = `Test_${suffix}_${Math.random().toString(36).slice(2)}`;

  // Create auth user
  const { data: signUp, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (signUpError || !signUp.user) throw new Error(`createUser: ${signUpError?.message}`);

  // Sign in to get access token
  const anonSupa = anonClient();
  const { data: signIn, error: signInError } = await anonSupa.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !signIn.session) throw new Error(`signIn: ${signInError?.message}`);

  const userId = signUp.user.id;
  const accessToken = signIn.session.access_token;
  const slug = `test-${suffix}-${Math.random().toString(36).slice(2, 8)}`;

  // Create client row (service role — INSERT not allowed via RLS)
  const clientInsert: ClientInsert = {
    slug,
    status: 'claimed',
    niche: 'barber',
    business_name: `Test Barber ${suffix}`,
    city: 'Brooklyn',
    state: 'NY',
    owner_user_id: userId,
    claim_token: `tok_test_${suffix}`,
  };
  const { data: client, error: clientError } = await admin
    .from('clients')
    .insert(clientInsert)
    .select('id')
    .single();
  if (clientError || !client) throw new Error(`insertClient: ${clientError?.message}`);

  // Create published content
  const contentInsert: ContentInsert = {
    client_id: client.id,
    version: 1,
    is_published: true,
    hero_headline: `${suffix} Headline`,
    hero_subheadline: `${suffix} sub`,
  };
  const { data: content, error: contentError } = await admin
    .from('content')
    .insert(contentInsert)
    .select('id')
    .single();
  if (contentError || !content) throw new Error(`insertContent: ${contentError?.message}`);

  return {
    clientId: client.id,
    userId,
    accessToken,
    slug,
    contentId: content.id,
  };
}

/** Clean up test tenant completely. Call in afterAll. */
export async function deleteTestTenant(tenant: TestTenant): Promise<void> {
  const admin = serviceClient();
  await admin.from('clients').delete().eq('id', tenant.clientId);
  await admin.auth.admin.deleteUser(tenant.userId);
}
