// Shared rep-auth helpers. Pulls the authenticated rep's row off of the
// supabase session cookie, used by the /reps layout, page handlers, and
// /api/reps/* route handlers.

import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import type { SalesRepRow } from '@dfy/db';

export type RepContext = {
  userId: string;
  email: string;
  rep: SalesRepRow;
};

// Fetch the authenticated rep's row. The service-role client is used to
// dodge RLS (which would also work, but only when status='active' under
// the existing policies — we need to surface pending/disabled too so the
// layout can route to the right holding page).
export async function getAuthenticatedRep(): Promise<RepContext | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createServiceRoleClient();
  const { data: rep } = await admin
    .from('sales_reps')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!rep) return null;
  return { userId: user.id, email: user.email ?? '', rep };
}
