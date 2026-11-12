// Branded, per-client Starter checkout page. Handed out by an operator in
// place of a raw Stripe payment link — looks professional and reuses the
// landing-page pricing copy. The Subscribe button POSTs to /api/pay/[id],
// which creates a Stripe Checkout session with client_id baked in so the
// webhook can claim the site and provision the domain.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cheapBrandOrigin, isCheapBrandClient } from '@/lib/marketing-brand';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { PRICING } from '@/lib/pricing';
import { SubscribeButton } from './SubscribeButton';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ plan?: string }>;
};

// Plans that have a branded checkout page. `plan` is carried through to
// /api/pay/[id] so the right Stripe price (and billing interval) is charged.
const BRANDED_PLANS = {
  starter: {
    name: 'Starter plan',
    amount: `$${PRICING.starter.monthly}`,
    per: '/ month',
    blurb: 'Hosting, domain, edits & support — all in. Cancel anytime.',
    buttonLabel: `Subscribe — ${PRICING.starter.label}`,
  },
  biweekly: {
    name: 'Biweekly plan',
    amount: '$34.50',
    per: '/ 2 weeks',
    blurb: 'Hosting, domain, edits & support — all in. Billed every 2 weeks. Cancel anytime.',
    buttonLabel: `Subscribe — ${PRICING.biweekly.label}`,
  },
  sms: {
    name: 'Starter + SMS plan',
    amount: `$${PRICING.sms.monthly}`,
    per: '/ month',
    blurb: 'Everything in Starter, plus every new lead texted straight to your phone. Cancel anytime.',
    buttonLabel: `Subscribe — ${PRICING.sms.label}`,
  },
} as const;

type BrandedPlan = keyof typeof BRANDED_PLANS;

function resolvePlan(raw: string | undefined): BrandedPlan {
  if (raw === 'biweekly' || raw === 'sms') return raw;
  return 'starter';
}

// Checkout pages must never be indexed.
export const metadata: Metadata = {
  title: 'Get your site live — StoopCraft',
  robots: { index: false, follow: false },
};

const FEATURES = [
  'Custom-designed website',
  'Hosting + SSL included',
  'Your own custom domain',
  'Mobile-first on every screen',
  'Unlimited edits & updates',
  'SEO-ready structure',
  'Conversion-focused copy',
  'Ongoing support, real people',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-900 px-6 py-16 font-sans text-cream-50 selection:bg-amber-accent-soft/40">
      {children}
    </div>
  );
}

export default async function PayPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const planKey = resolvePlan((await searchParams).plan);
  const plan = BRANDED_PLANS[planKey];
  // The SMS plan is Starter + lead texts, so surface the extra perk in the
  // feature list. Every other plan uses the base list unchanged.
  const features =
    planKey === 'sms' ? ['New leads texted to your phone', ...FEATURES] : FEATURES;

  if (!UUID_RE.test(id)) {
    return (
      <Shell>
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-light">Checkout link not found</h1>
          <p className="mt-3 text-cream-100/60">
            This payment link looks invalid. Please double-check the link or contact us.
          </p>
        </div>
      </Shell>
    );
  }

  const admin = createServiceRoleClient();
  const { data: client } = await admin
    .from('clients')
    .select('id, business_name, status, owner_user_id, brand')
    .eq('id', id)
    .single();

  // Stupid Cheap Websites clients activate on their own brand's page.
  if (client && isCheapBrandClient(client.brand)) redirect(`${cheapBrandOrigin()}/pay/${client.id}`);

  if (!client) {
    return (
      <Shell>
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-light">Checkout link not found</h1>
          <p className="mt-3 text-cream-100/60">
            We couldn&rsquo;t find this site. Please double-check the link or contact us.
          </p>
        </div>
      </Shell>
    );
  }

  if (client.status === 'claimed' || client.owner_user_id) {
    return (
      <Shell>
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-light">You&rsquo;re all set</h1>
          <p className="mt-3 text-cream-100/60">
            This subscription is already active. Manage your site and billing from your portal.
          </p>
          <Link
            href="/portal"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-b from-amber-accent-soft to-amber-accent px-6 py-3 text-sm font-semibold text-ink-900 transition-all hover:-translate-y-0.5"
          >
            Go to your portal
          </Link>
        </div>
      </Shell>
    );
  }

  const businessName = client.business_name?.trim() || 'your business';

  return (
    <Shell>
      <div className="w-full max-w-lg">
        <div className="mb-10 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-amber-accent-soft">
            Activate your website
          </p>
          <h1 className="font-display text-3xl font-light tracking-tight sm:text-4xl">
            Take <span className="italic">{businessName}</span> live.
          </h1>
          <p className="mt-4 text-cream-100/60">
            Your site is built and ready. Start your hosting plan to publish it — hosting,
            domain, edits &amp; support all included. Cancel anytime.
          </p>
        </div>

        <div className="relative">
          {/* gradient border */}
          <div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-amber-accent-soft via-amber-accent to-amber-accent/30" />
          <div className="relative flex flex-col rounded-3xl bg-ink-900 p-8 sm:p-10">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm font-medium uppercase tracking-wider text-cream-100/70">
                {plan.name}
              </p>
              <span className="rounded-full bg-amber-accent/15 px-2.5 py-1 text-xs font-medium text-amber-accent-soft">
                All-in-one
              </span>
            </div>

            <div className="flex items-baseline gap-2 border-b border-white/10 pb-5">
              <span className="font-display text-5xl font-light tracking-tight">
                {plan.amount}
              </span>
              <span className="text-lg text-cream-100/70">{plan.per}</span>
            </div>
            <p className="mt-4 text-sm text-cream-100/55">{plan.blurb}</p>

            <ul className="my-8 grid gap-3.5 text-[15px] text-cream-100/80 sm:grid-cols-2">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-accent/15 text-amber-accent-soft">
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6.5 5 9l4.5-5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <SubscribeButton clientId={client.id} plan={planKey} buttonLabel={plan.buttonLabel} />
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-cream-100/40">
          🔒 Secure checkout via Stripe · Cancel anytime · No long-term contracts
        </p>
      </div>
    </Shell>
  );
}
