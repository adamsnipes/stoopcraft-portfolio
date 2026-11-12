import Stripe from 'stripe';
import { CHEAP_BRAND } from '@/lib/marketing-brand';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-04-22.dahlia',
    });
  }
  return stripeInstance;
}

// Plan names map 1:1 to Stripe checkout outcomes — one is the user-facing
// product mix, written to clients.plan, and the webhook switch cares about it.
export type Plan =
  | 'starter'
  | 'biweekly'
  | 'pro'
  | 'setup'
  | 'setup_plus_maintenance'
  | 'maintenance'
  | 'sms'
  // Stupid Cheap Websites' $40/month plan. Same Stripe account, its own price;
  // Checkout is rebranded per session (see createCheckoutSession).
  | 'scw';

// Single-price building blocks. Each maps to one Stripe price ID env var.
type PricePart = 'starter' | 'biweekly' | 'pro' | 'setup' | 'maintenance' | 'sms' | 'scw';

function getPriceId(part: PricePart): string {
  const envKey = {
    starter: 'STRIPE_STARTER_PRICE_ID',
    biweekly: 'STRIPE_BIWEEKLY_PRICE_ID',
    pro: 'STRIPE_PRO_PRICE_ID',
    setup: 'STRIPE_SETUP_PRICE_ID',
    maintenance: 'STRIPE_MAINTENANCE_PRICE_ID',
    sms: 'STRIPE_SMS_PRICE_ID',
    scw: 'STRIPE_SCW_PRICE_ID',
  }[part];
  const id = process.env[envKey];
  if (!id) throw new Error(`${envKey} not set`);
  return id;
}

type CreateParams = NonNullable<Parameters<Stripe['checkout']['sessions']['create']>[0]>;
type CheckoutShape = {
  mode: 'subscription' | 'payment';
  line_items: NonNullable<CreateParams['line_items']>;
};

function shapeForPlan(plan: Plan): CheckoutShape {
  switch (plan) {
    case 'starter':
      return { mode: 'subscription', line_items: [{ price: getPriceId('starter'), quantity: 1 }] };
    case 'biweekly':
      // Same product as Starter; the every-2-weeks interval lives on the
      // Stripe price object pointed to by STRIPE_BIWEEKLY_PRICE_ID.
      return { mode: 'subscription', line_items: [{ price: getPriceId('biweekly'), quantity: 1 }] };
    case 'pro':
      return { mode: 'subscription', line_items: [{ price: getPriceId('pro'), quantity: 1 }] };
    case 'maintenance':
      return { mode: 'subscription', line_items: [{ price: getPriceId('maintenance'), quantity: 1 }] };
    case 'sms':
      // Lead-notification texts add-on ($79/mo). The Stripe webhook flips
      // clients.sms_notifications_enabled when this subscription starts/ends.
      return { mode: 'subscription', line_items: [{ price: getPriceId('sms'), quantity: 1 }] };
    case 'scw':
      return { mode: 'subscription', line_items: [{ price: getPriceId('scw'), quantity: 1 }] };
    case 'setup':
      return { mode: 'payment', line_items: [{ price: getPriceId('setup'), quantity: 1 }] };
    case 'setup_plus_maintenance':
      // Stripe allows one-time line items inside subscription mode — the
      // setup fee shows up as an upfront charge on the first invoice.
      return {
        mode: 'subscription',
        line_items: [
          { price: getPriceId('setup'), quantity: 1 },
          { price: getPriceId('maintenance'), quantity: 1 },
        ],
      };
  }
}

/**
 * Create a Stripe Checkout session for a client.
 * client_id stored in metadata so the webhook can find the right row.
 * Email is optional: if omitted, Stripe collects it during checkout — that
 * email becomes authoritative for account creation.
 *
 * `domainChoice` + `requestedDomain` are landing-page-claim only — they
 * tell the webhook whether to set custom_domain immediately ("have") or
 * leave it for the operator to set after manual Namecheap registration
 * ("need"). Both end up in subscription.metadata so they survive future
 * subscription.updated events.
 */
export async function createCheckoutSession(opts: {
  clientId: string;
  plan: Plan;
  email?: string;
  successUrl: string;
  cancelUrl: string;
  domainChoice?: 'have' | 'need';
  requestedDomain?: string;
  // Carried into Stripe metadata so the webhook + subscription events can
  // include it in their funnel logs. Same UUID the visitor used on the
  // landing page — gives end-to-end log correlation in Axiom.
  funnelSessionId?: string | null;
}): Promise<string> {
  const stripe = getStripe();
  const { mode, line_items } = shapeForPlan(opts.plan);

  const claimMeta: Record<string, string> = {};
  if (opts.domainChoice) claimMeta['domain_choice'] = opts.domainChoice;
  if (opts.requestedDomain) claimMeta['requested_domain'] = opts.requestedDomain;
  if (opts.funnelSessionId) claimMeta['funnel_session_id'] = opts.funnelSessionId;

  const params: CreateParams = {
    mode,
    payment_method_types: ['card'],
    line_items,
    metadata: { client_id: opts.clientId, plan: opts.plan, ...claimMeta },
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    // Surfaces a "Promotion code" field on the checkout page. The codes
    // themselves must be created in the Stripe Dashboard; this flag only
    // permits customer entry of an existing one.
    allow_promotion_codes: true,
  };

  if (opts.email) params.customer_email = opts.email;

  if (opts.plan === 'scw') {
    // Stupid Cheap Websites runs on this same Stripe account. Rebrand the
    // Checkout page itself; Stripe still shows the account's business name in
    // its legal text, receipts and billing portal. Never set metadata.platform
    // here — the webhook treats any non-stoopcraft platform tag as another
    // platform's object and skips it.
    params.branding_settings = {
      display_name: CHEAP_BRAND.name,
      icon: { type: 'url', url: `${CHEAP_BRAND.url}/cheap-websites/apple-icon.png` },
      background_color: '#faf9f3',
      button_color: '#171717',
      border_style: 'rectangular',
      font_family: 'inter',
    };
  }

  if (mode === 'subscription') {
    // subscription_data only valid in subscription mode
    params.subscription_data = {
      metadata: { client_id: opts.clientId, plan: opts.plan, ...claimMeta },
    };
  } else {
    // Payment mode (one-time setup) — by default Stripe does NOT create a
    // Customer object. Force creation so the webhook captures
    // session.customer for refunds, future upsells, and a single Stripe
    // record per business.
    params.customer_creation = 'always';
  }

  const session = await stripe.checkout.sessions.create(params);

  if (!session.url) throw new Error('Stripe session has no URL');
  return session.url;
}

/**
 * Create a Stripe Customer Portal session.
 * Uses the customer's existing Stripe customer ID.
 */
export async function createPortalSession(opts: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: opts.stripeCustomerId,
    return_url: opts.returnUrl,
  });
  return session.url;
}
