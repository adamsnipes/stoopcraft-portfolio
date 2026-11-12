import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: { absolute: 'Terms of Service — StoopCraft Marketing' },
  description:
    'The terms that govern StoopCraft Marketing’s 3-day free ad trial and $499/mo done-for-you ad management service.',
  alternates: { canonical: '/marketing/terms' },
  robots: { index: false },
};

const LOGO_SRC = '/stoopcraft-marketing-logo-v2.png';
const CONTACT_EMAIL = 'hello@stoopcraft.com';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold text-cream-50">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-cream-100/70">{children}</div>
    </section>
  );
}

const TRIAL_STEPS: [string, string][] = [
  ['Book your free call', 'Tell us about your business on a short strategy call — we plan your first campaign.'],
  ['We launch your ads — free for 3 days', 'We create the ads, set up targeting, and go live. You cover only the ad spend; there is no management fee during the trial.'],
  ['Keep it going — or walk away', 'Happy with what you see? Continue for $499/mo. Not for you? Just tell us — we stop the campaigns and you owe us no management fee.'],
];

export default function MarketingTermsPage() {
  return (
    <div className="min-h-screen bg-navy-950 text-cream-50">
      <header className="border-b border-navy-700/50 bg-navy-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/marketing" className="flex items-center">
            <Image
              src={LOGO_SRC}
              alt="StoopCraft Marketing"
              width={2172}
              height={724}
              priority
              className="h-10 w-auto"
              sizes="240px"
            />
          </Link>
          <Link href="/marketing" className="text-sm text-cream-100/60 hover:text-gold-400">
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-16">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gold-400">
          StoopCraft Marketing
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight text-cream-50">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-cream-100/40">Last updated July 2026</p>

        <div className="mt-12 space-y-10">
          <Section title="How the free trial works">
            <p>
              We plan, build, and launch a real ad campaign for your business at no management fee
              for the first 3 days. You only pay for your own ad spend during the trial, and you owe
              us no management fee unless you choose to continue:
            </p>
            <ol className="mt-4 space-y-3">
              {TRIAL_STEPS.map(([title, body], i) => (
                <li key={title} className="flex gap-4">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-gold-300 to-gold-500 text-xs font-bold text-navy-950">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-cream-50">{title}</div>
                    <div className="text-sm text-cream-100/70">{body}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="What's included">
            <p>Our done-for-you ad management is a flat $499/month after the trial. It includes:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-gold-400/60">
              <li>Ad creative and copy written for your business</li>
              <li>Audience research and precise local targeting</li>
              <li>Day-to-day campaign management, testing, and optimization</li>
              <li>Lead and call tracking</li>
              <li>Plain-English performance reporting</li>
              <li>A dedicated point of contact for your account</li>
            </ul>
          </Section>

          <Section title="Ad spend is separate">
            <p>
              Your <span className="font-medium text-cream-50">ad spend</span> — the money paid to
              advertising platforms like Meta and Google to show your ads — is{' '}
              <span className="font-medium text-cream-50">not</span> included in the $499/mo
              management fee and is not included in the free trial. You are responsible for your own
              ad spend, you set and control your budget, and it is typically billed directly by the
              ad platform to your payment method. We&apos;ll recommend a budget, but the amount is
              always your decision.
            </p>
          </Section>

          <Section title="Results & performance">
            <p>
              Advertising results depend on many factors outside our control — your market,
              budget, offer, pricing, competition, seasonality, and how you handle the leads we
              generate. We bring real expertise and manage your campaigns diligently, but we{' '}
              <span className="font-medium text-cream-50">cannot and do not guarantee</span> a
              specific number of leads, calls, sales, cost per result, or return on ad spend.
            </p>
          </Section>

          <Section title="Your responsibilities">
            <ul className="list-disc space-y-1 pl-5 marker:text-gold-400/60">
              <li>Provide accurate business information and any assets we need to run your ads</li>
              <li>Give us timely access to the ad accounts, pages, and tools required</li>
              <li>Keep your ad-spend payment method on the platform in good standing</li>
              <li>Ensure your business, offers, and content comply with the ad platforms&apos; policies and applicable law</li>
              <li>Respond to the leads we generate — we drive the demand, you close it</li>
            </ul>
          </Section>

          <Section title="Payment">
            <ul className="list-disc space-y-1 pl-5 marker:text-gold-400/60">
              <li>No management fee for the 3-day trial (you cover ad spend only)</li>
              <li>After the trial, billed $499/mo in advance via Stripe</li>
              <li>All major credit and debit cards accepted</li>
              <li>Month-to-month — no long-term contract, cancel anytime</li>
              <li>Management fees are not pro-rated or refunded for partial months</li>
              <li>Ad spend is billed separately and is non-refundable once spent on the platform</li>
            </ul>
          </Section>

          <Section title="Cancellation">
            <p>
              You can cancel anytime — just let us know at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold-400 underline">
                {CONTACT_EMAIL}
              </a>
              . We&apos;ll pause and stop managing your campaigns at the end of your current billing
              period. There are no cancellation fees.
            </p>
          </Section>

          <Section title="Acceptable use">
            <p>
              We advertise for legitimate businesses only. We reserve the right to decline or stop
              service for anything that promotes illegal activity, contains hate speech, infringes
              intellectual property, is deceptive, or violates an ad platform&apos;s policies. You
              are responsible for having the right to use any content and offers you provide.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              StoopCraft Marketing provides the service &quot;as is&quot; without warranties of any
              kind, including any warranty of advertising results. Our total liability for any claim
              is limited to the management fees you paid us in the prior 3 months. We are not liable
              for ad spend, lost profits, or platform actions such as account suspensions or ad
              disapprovals. Disputes are resolved by binding arbitration.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms with 30 days&apos; notice via email. Continued use of the
              service after that period constitutes acceptance.
            </p>
          </Section>

          <div className="border-t border-navy-700/50 pt-6 text-sm text-cream-100/50">
            Questions? Email us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold-400 underline">
              {CONTACT_EMAIL}
            </a>
            .
          </div>
        </div>
      </main>
    </div>
  );
}
