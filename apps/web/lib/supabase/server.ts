import { createServerClient as createSSRClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@dfy/db';

/**
 * Anon Supabase client for Server Components and Route Handlers.
 * Uses the cookie-based session for authenticated requests.
 * RLS enforces access — this client respects tenant boundaries.
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — read-only, safe to ignore
          }
        },
      },
    }
  );
}

/**
 * Service role client — bypasses RLS entirely.
 * ONLY use for:
 *   - Admin operations
 *   - Pre-sale page rendering (after token validation)
 *   - Server-side data writes during generation pipeline
 * NEVER expose this client to browser code.
 */
export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
