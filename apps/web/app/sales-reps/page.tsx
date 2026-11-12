// Internal playbook for promoted sales reps. The public version of this
// page used to be at /sales-reps but the public funnel has been collapsed
// into /affiliates — anyone who lands here who isn't an admin-promoted
// rep gets redirected there. The content stays as the active-outreach
// reference for reps you've upgraded from /admin/reps.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';
import { getDefaultCommissionPct } from '@/lib/platform-settings';

export const metadata: Metadata = {
  alternates: { canonical: '/sales-reps' },
  title: 'Sales rep program',
  description:
    'How the Stoopcraft sales-rep program works — 50% recurring commission on every customer you bring in.',
};

const DISCORD_INVITE_URL = process.env.SALES_REP_DISCORD_INVITE_URL ?? null;

export default async function SalesRepsPage() {
  const ctx = await getAuthenticatedRep();
  // Page is now reps-only. Anyone not currently a kind='rep' (logged-out
  // visitors, affiliates, customers) bounces to the public funnel.
  if (!ctx || ctx.rep.kind !== 'rep') {
    redirect('/affiliates');
  }
  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const proto = platformDomain.startsWith('localhost') ? 'http' : 'https';
  const refLink = ctx ? `${proto}://${platformDomain}/r/${ctx.rep.code}` : null;
  // Logged-out visitors see the current default from platform_settings
  // (editable from /admin/settings, no deploy). Logged-in reps see their
  // actual rate, which admin can override per-rep from /admin/reps.
  const commissionPct = ctx?.rep.commission_pct ?? (await getDefaultCommissionPct('rep'));

  return (
    <div className="min-h-screen bg-cream-50 text-ink-900 font-sans">
      <header className="border-b border-ink-900/10 bg-cream-50/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <Link href={ctx ? '/reps' : '/'} className="flex items-center gap-2 font-display text-lg tracking-tight">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-accent" />
            <span className="font-semibold">Stoopcraft</span>
            <span className="hidden sm:inline text-ink-700/60 font-normal">Sales rep program</span>
          </Link>
          {ctx ? (
            <Link
              href="/reps"
              className="px-3 py-1.5 rounded-full text-sm bg-ink-900 text-cream-50 hover:bg-ink-800"
            >
              Open dashboard
            </Link>
          ) : (
            <Link
              href="/reps/login"
              className="px-3 py-1.5 rounded-full text-sm bg-ink-900 text-cream-50 hover:bg-ink-800"
            >
              Apply
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <article className="space-y-10">
          <section className="space-y-4">
            <h1 className="font-display text-4xl sm:text-5xl font-light tracking-tight">
              Earn <span className="text-amber-accent">{commissionPct}% recurring</span> on every business you bring in.
            </h1>
            <p className="text-lg text-ink-700">
              Stoopcraft builds full websites for local businesses in 60 seconds. Your job: find
              businesses that don&apos;t have one, generate a free preview from your dashboard, and
              close the sale. You earn {commissionPct}% of every monthly payment they make — for
              as long as they stay subscribed.
            </p>
            {!ctx && (
              <div className="bg-white border border-ink-900/10 rounded-2xl p-5 space-y-3">
                <div className="font-display text-xl tracking-tight">Ready to start?</div>
                <p className="text-sm text-ink-700">
                  Sign in with your email — we&apos;ll approve you and your dashboard unlocks.
                  Magic link only, no password.
                </p>
                <Link
                  href="/reps/login"
                  className="inline-block bg-amber-accent text-ink-900 px-5 py-2.5 rounded-lg font-semibold text-sm hover:brightness-95"
                >
                  Apply to be a rep →
                </Link>
              </div>
            )}
          </section>

          <Step n={1} title="Find a business without a website">
            <p>
              Open Google Maps, search a city or neighborhood, and scroll. You&apos;re looking for
              any small business where the &ldquo;Website&rdquo; field is missing — or where the
              link goes to a Facebook page, an Instagram profile, or a Yelp listing. That&apos;s
              your lead.
            </p>
            <Hint>
              <strong>Any niche works.</strong> Barber, salon, HVAC, roofer, taco truck, mobile
              detailer — if they don&apos;t have a real website, they&apos;re a candidate.
            </Hint>
            <Hint>
              <strong>&ldquo;No website&rdquo; means no real domain.</strong> A linked Facebook
              page or a Yelp listing doesn&apos;t count as a website. Those businesses still need
              what we sell.
            </Hint>
          </Step>

          <Step n={2} title="Generate their site from your dashboard">
            <p>
              Type the business name into <Code>/reps/generate</Code>, pick the right Google Maps
              result, and click <em>Generate</em>. ~30 seconds later you get back two links:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>
                <strong>Preview link</strong> — shows the customer their site with a &ldquo;Claim
                my site for $99/mo&rdquo; wizard built in. Use this for cold outreach.
              </li>
              <li>
                <strong>Direct payment link</strong> — skips the preview and drops them on Stripe
                Checkout. Use this only when they&apos;ve already said yes.
              </li>
            </ul>
            <Hint>
              <strong>Already in the system?</strong> If someone else generated the same business
              before you, the dashboard still gives you a preview link — and if you close the
              sale, the commission is yours. Whoever pushes the customer to buy gets the credit.
            </Hint>
            <Hint>
              <strong>Don&apos;t share an old payment link.</strong> Stripe Checkout sessions
              expire after 24 hours. If it&apos;s been more than a day since you generated it,
              open <Code>/reps/customers</Code>, find the row, and click <em>Get link</em> for a
              fresh one.
            </Hint>
          </Step>

          <Step n={3} title="Reach out">
            <p>
              Cold call, SMS, email, Instagram DM — whatever works. Lead with the preview link.
              The site itself is the pitch: they see their business name, photos, and a
              real-looking website in 60 seconds, and most people light up.
            </p>
            <p>
              Templates with your referral link pre-filled live at <Code>/reps/outreach</Code>.
              Customize before sending — they work better when they sound like you.
            </p>
            <Hint>
              <strong>Log every pitch in <Code>/reps/leads</Code>.</strong> Even cold misses. It
              keeps you from double-pitching the same place and gives you a record of what&apos;s
              working.
            </Hint>
            {refLink ? (
              <Hint>
                <strong>Your personal referral link:</strong>{' '}
                <code className="px-1.5 py-0.5 rounded bg-cream-100 font-mono text-xs break-all">
                  {refLink}
                </code>{' '}
                — anyone who clicks it gets attributed to you for 30 days, even if they generate
                their own site instead of going through one you made.
              </Hint>
            ) : (
              <Hint>
                <strong>Every rep gets a personal referral URL</strong> (e.g.{' '}
                <code className="px-1.5 py-0.5 rounded bg-cream-100 font-mono text-xs">
                  {proto}://{platformDomain}/r/your-name
                </code>
                ). Anyone who clicks it gets attributed to you for 30 days — even if they end up
                generating their own site instead of going through one you made.
              </Hint>
            )}
          </Step>

          <Step n={4} title="When they say yes, send the payment link">
            <p>
              Open <Code>/reps/customers</Code>, find the row, and click <em>Get link</em>. That
              copies a fresh Stripe Checkout URL to your clipboard. Text or email it over.
            </p>
            <p>
              Before you send, ask the customer one question:{' '}
              <em>do they have a domain name they want to use, or do they want us to register one
              for them?</em> Either answer is fine — both are part of the $99/mo. We need the
              answer to wire things up after payment.
            </p>
          </Step>

          <Step n={5} title="After payment — domain handoff and customer support">
            <p>
              As soon as the customer pays, ping the team{' '}
              {DISCORD_INVITE_URL ? (
                <a className="underline" href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
                  in the Discord channel
                </a>
              ) : (
                'in the Discord channel (link coming soon)'
              )}{' '}
              with:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>The business name</li>
              <li>Whether the customer has a domain (and what it is) or wants us to register one</li>
            </ul>
            <p>
              We handle the domain registration / DNS wiring. You don&apos;t need to. Once
              it&apos;s live, the customer gets a welcome email with portal access.
            </p>
            <p className="font-medium">Tell the customer how to make changes:</p>
            <blockquote className="border-l-2 border-amber-accent pl-4 italic text-sm text-ink-700">
              You&apos;ll get a welcome email with a link to your customer portal. Click{' '}
              <em>Request a change</em> there for any edits — new photos, hours, copy tweaks,
              anything. You can also use the chat widget on your site and just say &ldquo;request
              an edit to my page.&rdquo;
            </blockquote>
          </Step>

          <section className="space-y-4 bg-white border border-ink-900/10 rounded-2xl p-6">
            <h2 className="font-display text-2xl tracking-tight">How payouts work</h2>
            <p>
              You earn <strong>{commissionPct}% of every paid monthly invoice</strong> from every
              customer attributed to you — for as long as they keep paying. Cancellation just
              stops future commission; it doesn&apos;t claw back what you&apos;ve already earned.
            </p>
            <p>
              <strong>14-day vesting on first payments.</strong> When a customer first pays, their
              commission shows up{' '}
              {ctx ? (
                <>
                  in <Code>/reps/commissions</Code> as <em>Vesting</em>
                </>
              ) : (
                <>
                  in your dashboard as <em>Vesting</em>
                </>
              )}
              . It locks in 14 days later if they haven&apos;t cancelled. If they cancel inside
              that window, the commission gets voided — but renewals after the first month vest
              immediately on payment.
            </p>
            <p>
              <strong>Payouts run on the 1st and 15th of every month.</strong> Anything in the
              &ldquo;Vested · ready to pay&rdquo; bucket on those days goes out in that cycle.
              If your customer paid less than 14 days before a payout day, they&apos;ll roll into
              the next one instead. Sent via PayPal or Venmo — set your payout method in{' '}
              <Link className="underline" href="/reps/settings">/reps/settings</Link>.
            </p>
          </section>

          <section className="space-y-3 bg-white border border-ink-900/10 rounded-2xl p-6">
            <h2 className="font-display text-2xl tracking-tight">A few things to keep in mind</h2>
            <ul className="space-y-2 text-sm">
              <li>
                <strong>Don&apos;t pitch businesses we already serve.</strong> The duplicate
                prospect check lets you take over an unclaimed site, but if a business is already
                a paying customer (status = <em>claimed</em>), they&apos;re off-limits.
              </li>
              <li>
                <strong>Don&apos;t over-promise.</strong> The Starter plan is $99/mo, includes
                hosting and a domain and edits via the portal. We don&apos;t do custom design
                work, custom integrations, or on-call dev work at this price.
              </li>
              <li>
                <strong>If a customer wants more than the Starter plan can do, ping in Discord
                first.</strong> Don&apos;t commit on our behalf.
              </li>
              <li>
                <strong>Questions, blockers, weird edge cases:</strong>{' '}
                {DISCORD_INVITE_URL ? (
                  <a className="underline" href={DISCORD_INVITE_URL} target="_blank" rel="noopener noreferrer">
                    Discord
                  </a>
                ) : (
                  'Discord (link coming soon)'
                )}
                . Don&apos;t guess — ask.
              </li>
            </ul>
          </section>

          {!ctx && (
            <section className="bg-ink-900 text-cream-50 rounded-2xl p-6 space-y-4 text-center">
              <h2 className="font-display text-2xl tracking-tight">Sound good?</h2>
              <p className="text-cream-50/80">
                Sign in with your email and we&apos;ll approve you. Magic link only, no password.
              </p>
              <Link
                href="/reps/login"
                className="inline-block bg-amber-accent text-ink-900 px-5 py-2.5 rounded-lg font-semibold text-sm hover:brightness-95"
              >
                Apply to be a rep →
              </Link>
            </section>
          )}
        </article>
      </main>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[auto_1fr] gap-4">
      <div className="w-9 h-9 rounded-full bg-amber-accent/10 border border-amber-accent/30 text-amber-accent flex items-center justify-center font-semibold">
        {n}
      </div>
      <div className="space-y-3 pt-1">
        <h2 className="font-display text-2xl tracking-tight">{title}</h2>
        <div className="space-y-3 text-ink-800">{children}</div>
      </div>
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-cream-100 border border-ink-900/5 rounded-lg px-3 py-2 text-sm">
      {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-cream-100 font-mono text-xs">{children}</code>
  );
}
