'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@dfy/db';

/**
 * Browser Supabase client — anon key only, RLS enforced.
 * Use in Client Components for auth flows (magic link, session refresh).
 * NEVER import or use service role key on the client side.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
