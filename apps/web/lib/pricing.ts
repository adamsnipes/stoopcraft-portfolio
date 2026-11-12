// ============================================================================
// Pricing — single source of truth for every dollar amount we display.
//
// Every customer-facing surface (landing page, claim card, checkout button,
// transactional emails, terms of service, admin payment-link panel) reads
// from this module. Changing a price is now one edit here + a Stripe
// Dashboard update — never a sweep across 6 files.
//
// IMPORTANT: changing a `monthly`/`oneTime` value here is COPY-ONLY. The
// actual amount billed is determined by the Stripe price object pointed to
// by the corresponding env var (e.g. STRIPE_STARTER_PRICE_ID). After
// changing a price here, you MUST also:
//   1. Create a new price object in the Stripe Dashboard
//   2. Repoint the env var in Vercel (production + staging)
//   3. Existing subscriptions stay grandfathered at their original price;
//      Stripe webhooks keep `clients.plan` in sync regardless of which
//      price object the subscription was created against.
// ============================================================================

type PlanPrice = {
  /** Monthly recurring amount in USD whole dollars (e.g. 99). */
  monthly?: number;
  /** Recurring amount in USD billed every two weeks (e.g. 34.5). */
  biweekly?: number;
  /** One-time amount in USD whole dollars (e.g. 300). */
  oneTime?: number;
  /** Display label rendered in UI. Always the source of truth for copy. */
  label: string;
  /** Env var name that holds the corresponding Stripe price ID, if any. */
  stripeEnvVar?: string;
  /** Free-form note rendered in admin tooling / docs. */
  note?: string;
};

export const PRICING = {
  // Public Starter — the only plan new sign-ups can subscribe to.
  starter: {
    monthly: 99,
    label: '$99/mo',
    stripeEnvVar: 'STRIPE_STARTER_PRICE_ID',
  },
  // Biweekly hosting plan — admin-issued via the branded /pay/[id]?plan=biweekly
  // page. Same product as Starter, charged every 2 weeks instead of monthly.
  biweekly: {
    biweekly: 34.5,
    label: '$34.50 / 2 weeks',
    stripeEnvVar: 'STRIPE_BIWEEKLY_PRICE_ID',
  },
  // Pause-instead-of-cancel plan offered at cancellation time.
  pause: {
    monthly: 19,
    label: '$19/mo',
    stripeEnvVar: 'STRIPE_PAUSE_PRICE_ID',
  },
  // Recurring maintenance add-on (admin-issued via PaymentLinkPanel).
  maintenance: {
    monthly: 39,
    label: '$39/mo',
    stripeEnvVar: 'STRIPE_MAINTENANCE_PRICE_ID',
  },
  // Lead-notification texts add-on (admin-issued via PaymentLinkPanel). When
  // purchased, the Stripe webhook flips clients.sms_notifications_enabled so
  // the contact route starts texting leads (see the sms_notifications migration).
  sms: {
    monthly: 79,
    label: '$79/mo',
    stripeEnvVar: 'STRIPE_SMS_PRICE_ID',
  },
  // One-time setup fee bundled with maintenance via the admin panel.
  setup: {
    oneTime: 300,
    label: '$300',
    stripeEnvVar: 'STRIPE_SETUP_PRICE_ID',
  },
  // Legacy Pro tier — no new sign-ups; retained for grandfathered
  // customers whose subscription pre-dates the Starter consolidation.
  pro: {
    monthly: 149,
    label: '$149/mo',
    stripeEnvVar: 'STRIPE_PRO_PRICE_ID',
    note: 'grandfathered',
  },
} satisfies Record<string, PlanPrice>;

export type PlanKey = keyof typeof PRICING;
