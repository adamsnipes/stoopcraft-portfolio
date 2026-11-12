import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { serviceAccountEmail } from '@/lib/gsc/auth';
import { SopBoard } from './SopBoard';

export const metadata: Metadata = { title: 'Onboarding SOP' };
export const dynamic = 'force-dynamic';

/**
 * Standard operating procedure for onboarding a client, as a tickable
 * checklist. Content lives in ./sop-data.tsx.
 *
 * The env-derived values (Vercel DNS targets, GSC service account) are read
 * here rather than hardcoded into the copy so the page can't tell a new hire
 * to publish a record this project doesn't actually use.
 */
export default async function SopPage() {
  const supabase = createServiceRoleClient();
  const { data: clients } = await supabase
    .from('clients')
    .select('id, business_name, status')
    .in('status', ['live', 'claimed'])
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <SopBoard
      config={{
        aRecord: process.env.VERCEL_PROJECT_A_RECORD ?? null,
        cname: process.env.VERCEL_PROJECT_CNAME ?? null,
        // Falls back to the known agency service account so the address still
        // shows in environments where the key isn't configured (local dev).
        gscServiceAccount:
          serviceAccountEmail() ?? 'gsc-reporter@total-byte-505323-q6.iam.gserviceaccount.com',
      }}
      clients={clients ?? []}
    />
  );
}
