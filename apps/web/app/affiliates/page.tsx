// Public affiliate program page. Lower-touch sibling of /sales-reps:
//   - No sales process — just share a link, earn passive recurring commission.
//   - Auto-active on signup (no manual approval).
//   - Default 20% commission (vs 50% for active sales reps).
//
// Rendered in two modes (same pattern as /sales-reps):
//   - Logged-out: marketing intro + Apply CTA → /affiliates/login
//   - Logged-in affiliate: personalized referral link + Open dashboard

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';
import { getDefaultCommissionPct } from '@/lib/platform-settings';

// Shared between /sales-reps, /affiliates, and the /reps dashboard — same
// community space for both rep tiers. Originally named for sales-reps; the
// name is kept for back-compat with the existing env entry.
const DISCORD_INVITE_URL = process.env.SALES_REP_DISCORD_INVITE_URL ?? null;

export const metadata: Metadata = {
  alternates: { canonical: '/affiliates' },
  title: 'Affiliate program',
  description:
    'Earn recurring commission on every Stoopcraft customer who signs up through your link.',
};

export default async function AffiliatesPage() {
  const ctx = await getAuthenticatedRep();
  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const proto = platformDomain.startsWith('localhost') ? 'http' : 'https';
  const refLink = ctx ? `${proto}://${platformDomain}/r/${ctx.rep.code}` : null;
  const isAffiliate = ctx?.rep.kind === 'affiliate';
  // Logged-out visitors see the current default from platform_settings
  // (editable from /admin/settings, no deploy). Logged-in affiliates see
  // their actual rate, which admin can override per-affiliate from /admin/reps.
  const commissionPct = ctx?.rep.commission_pct ?? (await getDefaultCommissionPct('affiliate'));

  return (
    <div className="min-h-screen bg-cream-50 text-ink-900 font-sans">
      <header className="border-b border-ink-900/10 bg-cream-50/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <Link
            href={ctx ? '/reps' : '/'}
            className="flex items-center gap-2 font-display text-lg tracking-tight"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-amber-accent" />
            <span className="font-semibold">Stoopcraft</span>
            <span className="hidden sm:inline text-ink-700/60 font-normal">Affiliate program</span>
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
              href="/affiliates/login"
              className="px-3 py-1.5 rounded-full text-sm bg-ink-900 text-cream-50 hover:bg-ink-800"
            >
              Sign up
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <article className="space-y-10">
          <section className="space-y-4">
            <h1 className="font-display text-4xl sm:text-5xl font-light tracking-tight">
              Earn <span className="text-amber-accent">{commissionPct}% recurring</span> for every signup through your link.
            </h1>
            <p className="text-lg text-ink-700">
              Stoopcraft builds full websites for local businesses in 60 seconds. Drop your
              referral link in a tweet, a YouTube description, a Discord server, a newsletter —
              anywhere your audience lives. We do the rest. You earn {commissionPct}% of every
              monthly payment, every month, for as long as the customer stays subscribed.
            </p>
            {!ctx && (
              <div className="bg-white border border-ink-900/10 rounded-2xl p-5 space-y-3">
                <div className="font-display text-xl tracking-tight">Sign up in 30 seconds</div>
                <p className="text-sm text-ink-700">
                  Enter your email, click the magic link, get your dashboard. No application, no
                  approval wait, no minimum following.
                </p>
                <Link
                  href="/affiliates/login"
                  className="inline-block bg-amber-accent text-ink-900 px-5 py-2.5 rounded-lg font-semibold text-sm hover:brightness-95"
                >
                  Get my affiliate link →
                </Link>
              </div>
            )}
          </section>

          <Section title="How it works">
            <ol className="list-decimal pl-5 space-y-3 text-ink-800">
              <li>
                <strong>Sign up</strong> with your email — your dashboard activates immediately.
              </li>
              <li>
                <strong>Get your personal referral link</strong>{' '}
                {refLink ? (
                  <>
                    (
                    <code className="px-1.5 py-0.5 rounded bg-cream-100 font-mono text-xs break-all">
                      {refLink}
                    </code>
                    ).
                  </>
                ) : (
                  <>
                    (something like{' '}
                    <code className="px-1.5 py-0.5 rounded bg-cream-100 font-mono text-xs">
                      {proto}://{platformDomain}/r/your-name
                    </code>
                    ).
                  </>
                )}
              </li>
              <li>
                <strong>Share it.</strong> Tweet, blog, YouTube description, Discord server,
                newsletter, TikTok bio — anywhere a local business owner might see it.
              </li>
              <li>
                <strong>Anyone who clicks it</strong> is attributed to you for 30 days. When they
                generate a site and subscribe ($99/mo), you earn{' '}
                <strong>{commissionPct}% of every monthly payment</strong> for as long as they
                stay.
              </li>
              <li>
                <strong>Get paid bi-monthly</strong> on the 1st and 15th, via PayPal or Venmo
                (you pick — set it up in your dashboard after signing up).
              </li>
            </ol>
          </Section>

          <Section title="Want to earn more? Go active.">
            <p>
              The baseline program is passive: share your link, earn forever, no
              quotas. But if you want to put in real work, we reward it. Active
              sellers who consistently bring in customers get bumped to a higher
              commission tier and unlock extra tools — per-prospect site generation,
              a built-in lead CRM, and cold-pitch templates.
            </p>
            <p className="font-semibold">Things that move you toward an upgrade:</p>
            <ul className="space-y-2 text-ink-800">
              <li>✓ Cold-calling local businesses in your area</li>
              <li>✓ SMS or DM pitching directly to specific shops</li>
              <li>✓ Walking your neighborhood and pitching in person</li>
              <li>✓ Pre-generating sites for specific prospects so you can send
                them a personalized preview link</li>
              <li>✓ Following up with warm leads until they sign</li>
            </ul>
            <p className="text-sm text-ink-700/70">
              Once you&apos;ve brought in a few customers consistently, reach out
              and we&apos;ll upgrade you.
            </p>
          </Section>

          <Section title="How payouts work">
            <p>
              You earn <strong>{commissionPct}% of every paid monthly invoice</strong> from every
              customer attributed to you, for as long as they keep paying. Cancellation just
              stops future commission; it doesn&apos;t claw back what you&apos;ve already earned.
            </p>
            <p>
              <strong>14-day vesting on first payments.</strong> When a customer first pays, their
              commission shows up in your dashboard as <em>Vesting</em>. It locks in 14 days later
              if they haven&apos;t cancelled. If they cancel inside that window, the commission
              gets voided — but renewals after the first month vest immediately on payment.
            </p>
            <p>
              <strong>Payouts run on the 1st and 15th of every month</strong>, sent via PayPal or
              Venmo (your choice — set it up in <em>Settings</em> after signing up). Anything in
              the &ldquo;Vested · ready to pay&rdquo; bucket on those days goes out in that cycle.
              If your customer paid less than 14 days before a payout day, they&apos;ll roll into
              the next one instead.
            </p>
          </Section>

          <Section title="A few rules">
            <ul className="space-y-2 text-sm">
              <li>
                <strong>No paid search on Stoopcraft brand keywords.</strong> Don&apos;t bid on
                &ldquo;stoopcraft&rdquo; or variants in Google Ads — that traffic was coming
                anyway.
              </li>
              <li>
                <strong>No spammy SMS / email blasts.</strong> If we get reports, your account
                gets disabled and pending commission voided. Share organically.
              </li>
              <li>
                <strong>FTC disclosure.</strong> If you have a US audience and you&apos;re
                blogging / posting about Stoopcraft, say you get paid if they sign up. Standard
                affiliate-disclosure stuff.
              </li>
              <li>
                <strong>Self-referrals don&apos;t count.</strong> You can&apos;t use your own link
                to subscribe a site for yourself and earn commission.
              </li>
            </ul>
          </Section>

          {isAffiliate && refLink && (
            <section className="bg-amber-accent/10 border border-amber-accent/30 rounded-2xl p-5 space-y-2">
              <div className="font-display text-xl tracking-tight">Your link is live</div>
              <code className="block bg-white border border-ink-900/10 rounded-lg p-3 font-mono text-sm break-all">
                {refLink}
              </code>
              <p className="text-sm text-ink-700/70">
                Drop this anywhere. We&apos;ll attribute everyone who clicks it for 30 days.
              </p>
              <Link
                href="/reps"
                className="inline-block mt-2 bg-ink-900 text-cream-50 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Open dashboard →
              </Link>
            </section>
          )}

          <Section title="Have questions?">
            <p>
              Join the Stoopcraft community on Discord — pitch templates that are working
              right now, screenshots of recent payouts, niche ideas, and direct access to
              the team. Best place to ask &ldquo;is anyone else seeing X&rdquo; or get a
              quick gut-check before you send a cold pitch.
            </p>
            {DISCORD_INVITE_URL ? (
              <a
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#5865F2] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:brightness-95"
              >
                <DiscordGlyph /> Join the Discord
              </a>
            ) : (
              <p className="text-sm text-ink-700/60">
                Discord invite coming soon — check back shortly.
              </p>
            )}
          </Section>

          {!ctx && (
            <section className="bg-ink-900 text-cream-50 rounded-2xl p-6 space-y-4 text-center">
              <h2 className="font-display text-2xl tracking-tight">Ready?</h2>
              <p className="text-cream-50/80">
                Sign in with your email and your link is live in 30 seconds.
              </p>
              <Link
                href="/affiliates/login"
                className="inline-block bg-amber-accent text-ink-900 px-5 py-2.5 rounded-lg font-semibold text-sm hover:brightness-95"
              >
                Get my affiliate link →
              </Link>
            </section>
          )}
        </article>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 bg-white border border-ink-900/10 rounded-2xl p-6">
      <h2 className="font-display text-2xl tracking-tight">{title}</h2>
      <div className="space-y-3 text-ink-800 text-sm sm:text-base">{children}</div>
    </section>
  );
}

function DiscordGlyph() {
  return (
    <svg width="18" height="14" viewBox="0 0 71 55" fill="currentColor" aria-hidden="true">
      <path d="M60.1 4.9A58.6 58.6 0 0 0 45.7.5a.2.2 0 0 0-.2.1c-.6 1.1-1.3 2.6-1.8 3.7a54 54 0 0 0-16.4 0c-.5-1.2-1.2-2.6-1.9-3.7a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.7 4.9a.2.2 0 0 0-.1.1A60 60 0 0 0 .1 45.6a.2.2 0 0 0 .1.2 59 59 0 0 0 17.7 9 .2.2 0 0 0 .2-.1 42.3 42.3 0 0 0 3.6-5.9.2.2 0 0 0-.1-.2 39 39 0 0 1-5.5-2.6.2.2 0 0 1 0-.3l1.1-.9a.2.2 0 0 1 .2 0 42 42 0 0 0 35.7 0 .2.2 0 0 1 .2 0l1.1.9a.2.2 0 0 1 0 .3 36.7 36.7 0 0 1-5.5 2.6.2.2 0 0 0-.1.2 47.5 47.5 0 0 0 3.6 5.9.2.2 0 0 0 .2.1 59 59 0 0 0 17.7-9 .2.2 0 0 0 .1-.2A60 60 0 0 0 60.2 5a.2.2 0 0 0-.1-.1ZM23.7 37.3c-3.5 0-6.4-3.2-6.4-7.1 0-4 2.8-7.2 6.4-7.2 3.6 0 6.5 3.2 6.4 7.2 0 4-2.8 7.1-6.4 7.1Zm23.7 0c-3.5 0-6.4-3.2-6.4-7.1 0-4 2.8-7.2 6.4-7.2 3.6 0 6.5 3.2 6.4 7.2 0 4-2.8 7.1-6.4 7.1Z" />
    </svg>
  );
}
