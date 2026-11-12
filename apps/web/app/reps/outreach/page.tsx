import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';
import { OutreachTemplates } from './OutreachTemplates';

export const metadata: Metadata = { title: 'Outreach' };

export default async function OutreachPage() {
  const ctx = await getAuthenticatedRep();
  if (!ctx) redirect('/reps/login');

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const proto = platformDomain.startsWith('localhost') ? 'http' : 'https';
  const landingUrl = `${proto}://${platformDomain}/`;
  const refLink = `${proto}://${platformDomain}/r/${ctx.rep.code}`;
  const repName = ctx.rep.name ?? '';
  const isAffiliate = ctx.rep.kind === 'affiliate';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-light tracking-tight">
          {isAffiliate ? 'Share kit' : 'Outreach kit'}
        </h1>
        <p className="text-sm text-ink-700 mt-1">
          {isAffiliate
            ? 'Copy-paste content for the places you post — Twitter, YouTube descriptions, blog intros, Discord plugs. Your referral link is pre-filled. Personalize before publishing.'
            : 'Copy-paste templates with your referral link pre-filled. Personalize before sending — these are starting points, not scripts.'}
        </p>
      </header>

      {/* Inline how-to for the "pre-generate for a specific prospect" workflow.
          Shown to affiliates since they don't have /reps/generate (rep-only tool);
          works for anyone targeting a known business. */}
      {isAffiliate && (
        <section className="bg-white border border-ink-900/10 rounded-2xl p-5 space-y-3">
          <h2 className="font-display text-xl tracking-tight">
            Pre-generate a site for a specific prospect
          </h2>
          <p className="text-sm text-ink-700">
            If you&apos;re reaching out to a specific business (cold call, SMS, in-person)
            and want to show them <em>their</em> site instead of just a link, this is the
            move. The generated URL is automatically attributed to you as long as
            you&apos;re signed in.
          </p>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-ink-700">
            <li>
              Stay signed in here (you already are).{' '}
              <a
                href={landingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-accent underline underline-offset-2"
              >
                Open {platformDomain} in a new tab →
              </a>
            </li>
            <li>Type the prospect&apos;s business name, pick their Google listing, click Generate.</li>
            <li>After ~30 seconds the site renders in an iframe. Copy the URL at the top.</li>
            <li>Send that URL to the prospect via SMS / email / call. Attribution is already baked in.</li>
          </ol>
          <p className="text-xs text-ink-700/60">
            The plain link in the URL bar is your affiliate link — there&apos;s no
            extra code to add. When they click &ldquo;Claim my site for $99/mo&rdquo;
            and pay, the commission lands on{' '}
            <Link href="/reps/commissions" className="underline">your ledger</Link>{' '}
            automatically.
          </p>
        </section>
      )}

      <OutreachTemplates refLink={refLink} repName={repName} kind={isAffiliate ? 'affiliate' : 'rep'} />
    </div>
  );
}
