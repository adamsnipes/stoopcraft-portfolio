import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';
import { RepGenerateForm } from './RepGenerateForm';

export const metadata: Metadata = { title: 'Generate site' };

export default async function RepGeneratePage() {
  const ctx = await getAuthenticatedRep();
  if (!ctx) redirect('/reps/login');
  // Generate tool is rep-only — affiliates share their link, they don't
  // hand-generate sites for individual prospects.
  if (ctx.rep.kind === 'affiliate') redirect('/reps');

  return (
    <div className="space-y-6 max-w-2xl">
      <header>
        <h1 className="font-display text-3xl font-light tracking-tight">
          Generate a site
        </h1>
        <p className="text-sm text-ink-700 mt-1">
          Search Google, pick the right place, and we build the site in ~30
          seconds. You&apos;ll get both a preview link and a direct payment
          link — your referral is attached to both.
        </p>
      </header>

      <RepGenerateForm />
    </div>
  );
}
