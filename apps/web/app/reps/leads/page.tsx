import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { LeadsList } from './LeadsList';

export const metadata: Metadata = { title: 'Leads' };

export default async function LeadsPage() {
  const ctx = await getAuthenticatedRep();
  if (!ctx) redirect('/reps/login');
  // Leads CRM is rep-only — affiliates don't track individual outreach.
  if (ctx.rep.kind === 'affiliate') redirect('/reps');

  const admin = createServiceRoleClient();
  const { data: leads } = await admin
    .from('rep_leads')
    .select('*')
    .eq('sales_rep_id', ctx.rep.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-light tracking-tight">Leads</h1>
        <p className="text-sm text-ink-700 mt-1">
          Track who you&apos;ve pitched. Notes are private to you.
        </p>
      </header>

      <LeadsList initialLeads={leads ?? []} />
    </div>
  );
}
