import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendCheapBrandClientEmail } from '@/lib/email/cheap-brand';
import { getEmailProvider, sendAdminAlert } from '@/lib/email';
import { revalidateClientSite } from '@/lib/revalidation';
import { claimClient } from '@/lib/claim';
import { cancellationSync, isSupersededSubscription } from '@/lib/cancellation';
import { logFunnel, requestIdFromHeaders } from '@/lib/funnel-log';
import { provisionDomain, type ProvisionResult } from '@/lib/domain-provisioning';
import { commissionCentsFromGross, isCommissionEligiblePlan } from '@/lib/sales-rep/commission';

// Webhook event metadata carries `funnel_session_id` when the checkout
// came through the landing-page flow (we stuff it in via createCheckoutSession).
// Admin-form checkouts won't have it. For subscription.updated/deleted Stripe
// copies session metadata onto the subscription, so the same key lives there.
// As a fallback for events that don't carry metadata (e.g. invoice.*), look
// up the session id from the clients row.
function sessionIdFromMetadata(meta: Stripe.Metadata | null | undefined): string | null {
  if (!meta) return null;
  const v = meta['funnel_session_id'];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

// The Stripe account is shared with Scoop Unity (white-label, separate DB),
// which stamps metadata.platform on every session, subscription and payment
// intent it creates; invoices inherit it via parent.subscription_details.
// StoopCraft's own objects are untagged. Anything tagged for another platform
// is not ours: claiming it here would mint a login in this database for
// another brand's customer and fire alerts for a client we don't have.
function isOtherPlatform(object: unknown): boolean {
  const o = object as {
    metadata?: Stripe.Metadata | null;
    parent?: { subscription_details?: { metadata?: Stripe.Metadata | null } | null } | null;
  } | null;
  const tag = o?.metadata?.['platform'] ?? o?.parent?.subscription_details?.metadata?.['platform'];
  return typeof tag === 'string' && tag.length > 0 && tag !== 'stoopcraft';
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';
  const request_id = requestIdFromHeaders(req.headers);

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err);
    logFunnel({
      flow: 'stripe-webhook',
      event: 'error',
      request_id,
      error: 'invalid_signature',
    });
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  // 200 (not 4xx) so Stripe doesn't retry it at us.
  if (isOtherPlatform(event.data.object)) {
    return NextResponse.json({ received: true, ignored: 'other_platform' });
  }

  const admin = createServiceRoleClient();
  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'stoopcraft.com';

  // Idempotency: check if we already processed this event
  const { data: existing } = await admin
    .from('events')
    .select('id')
    .eq('type', `stripe_${event.type}`)
    .contains('metadata', { stripe_event_id: event.id })
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const clientId = session.metadata?.['client_id'];
      const plan = session.metadata?.['plan'];
      const funnel_session_id = sessionIdFromMetadata(session.metadata);

      if (!clientId || !plan) break;

      logFunnel({
        flow: 'stripe-webhook',
        event: 'start',
        request_id,
        funnel_session_id,
        client_id: clientId,
        stripe_event: event.type,
        stripe_event_id: event.id,
      });

      const stripeCustomerId = typeof session.customer === 'string' ? session.customer : null;
      const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
      const checkoutEmail = session.customer_details?.email ?? session.customer_email ?? null;

      // Landing-page-claim metadata. Both fields are optional — admin-form
      // checkouts (no domain step) won't have them, in which case we keep
      // the existing behaviour unchanged.
      const domainChoice = session.metadata?.['domain_choice'] as
        | 'have'
        | 'need'
        | undefined;
      const requestedDomain = session.metadata?.['requested_domain'] ?? null;

      // Webhook runs claim with onUserCreateError='log' — a missing auth
      // user shouldn't reject a paid Stripe checkout; /welcome will retry
      // generateLink in the customer's browser anyway.
      const { ownerUserId, isUpsell } = await claimClient(admin, {
        clientId,
        plan,
        email: checkoutEmail,
        stripeCustomerId,
        stripeSubscriptionId,
        onUserCreateError: 'log',
      });

      // Apply the domain choice. 'have' means the customer brought a
      // domain they already own — set custom_domain now so /portal and
      // emails reflect the right value. 'need' means we'll register on
      // their behalf — leave custom_domain null until manual registration
      // completes, but capture the requested name on the row so admin
      // tooling can show what to buy.
      if (domainChoice === 'have' && requestedDomain) {
        await admin
          .from('clients')
          .update({ custom_domain: requestedDomain })
          .eq('id', clientId);
      }

      await admin.from('events').insert({
        client_id: clientId,
        user_id: ownerUserId,
        type: 'stripe_checkout.session.completed',
        metadata: {
          stripe_event_id: event.id,
          plan,
          upsell: isUpsell,
          stripe_customer: stripeCustomerId ?? '',
          ...(domainChoice ? { domain_choice: domainChoice } : {}),
          ...(requestedDomain ? { requested_domain: requestedDomain } : {}),
        },
      });

      // Fan-out side-effects for landing-flow claims (skip for admin-form
      // checkouts which have no domain metadata). All non-fatal — if any
      // fail, the claim still stands; the operator can resend manually.
      // Stupid Cheap Websites checkout (/pay on that brand's domain): confirm
      // payment from the brand's own Resend account. Never routed through the
      // StoopCraft EmailProvider, so the customer sees no StoopCraft mail.
      if (plan === 'scw' && !isUpsell) {
        try {
          await sendCheapBrandClientEmail({ clientId, template: 'payment_received' });
        } catch (err) {
          console.error('scw payment_received email failed', { client_id: clientId, err });
        }
      }

      if (domainChoice && requestedDomain && !isUpsell) {
        const { data: client } = await admin
          .from('clients')
          .select('slug, business_name')
          .eq('id', clientId)
          .single();

        const tempSiteUrl = client
          ? `https://${client.slug}.${platformDomain}`
          : `https://${platformDomain}`;

        // Customer-facing "we got your payment, your domain is being set
        // up" — uses the new provisioning_started template which renders
        // different copy for 'have' vs 'need'.
        try {
          await getEmailProvider().send({
            clientId,
            template: 'provisioning_started',
            variables: {
              domain_choice: domainChoice,
              requested_domain: requestedDomain,
              temp_site_url: tempSiteUrl,
            },
          });
        } catch (err) {
          console.error('provisioning_started email failed', { client_id: clientId, err });
        }

        // Auto-register the domain when domain_choice='need' and the
        // feature flag is on. Returns 'skipped' (flag off / config missing)
        // when we shouldn't try. Result is folded into the operator alert
        // below so the admin sees the outcome in one email.
        let provisionResult: ProvisionResult | null = null;
        if (domainChoice === 'need') {
          try {
            provisionResult = await provisionDomain({
              admin,
              clientId,
              domain: requestedDomain,
            });
          } catch (err) {
            console.error('provisionDomain threw', { client_id: clientId, err });
            provisionResult = {
              status: 'failed',
              step: 'register',
              domain: requestedDomain,
              domain_registered: false,
              charged_amount_usd: null,
              error: err instanceof Error ? err.message : 'unknown_error',
            };
          }

          await admin.from('events').insert({
            client_id: clientId,
            type: 'domain_auto_provision_attempt',
            metadata: {
              domain: requestedDomain,
              ...(provisionResult as unknown as Record<string, unknown>),
            },
          });
        }

        // Operator alert — outcome of the provisioning attempt (or, when
        // skipped/disabled, the original manual-queue alert).
        try {
          const subject = subjectForProvisionResult(
            domainChoice,
            requestedDomain,
            provisionResult,
          );
          const adminUrl = `https://${platformDomain}/admin/clients/${clientId}`;
          await sendAdminAlert({
            subject,
            html: alertHtmlForProvisionResult({
              businessName: client?.business_name ?? null,
              clientId,
              checkoutEmail,
              domainChoice,
              requestedDomain,
              adminUrl,
              provisionResult,
            }),
          });
        } catch (err) {
          console.error('admin alert failed', { client_id: clientId, err });
        }
      }

      // Welcome email is operator-triggered after DNS is set up — see
      // POST /api/admin/clients/[id]/send-welcome. We don't fire it here
      // because at this point the customer's site is still on slug.* and
      // a "your site is live" email would point at a temporary URL.

      logFunnel({
        flow: 'stripe-webhook',
        event: 'ok',
        request_id,
        funnel_session_id,
        client_id: clientId,
        stripe_event: event.type,
        plan,
        upsell: isUpsell,
      });

      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const clientId = sub.metadata['client_id'];
      const funnel_session_id = sessionIdFromMetadata(sub.metadata);
      if (!clientId) break;

      const plan = sub.metadata['plan'];

      // Mirror cancel / un-cancel into our fields. Renewing before the period
      // ends must clear them, or the hard-delete cron would remove a paying
      // customer's site at the old date. Also catches a cancel made in Stripe's
      // own billing portal, which never touches our cancel routes.
      const { data: current } = await admin
        .from('clients')
        .select('cancelled_at, expires_at, stripe_subscription_id')
        .eq('id', clientId)
        .maybeSingle();
      if (isSupersededSubscription(sub.id, current?.stripe_subscription_id ?? null)) break;
      const cancellation = current ? cancellationSync(sub, current) : null;

      if (plan || cancellation) {
        await admin
          .from('clients')
          .update({ ...(plan ? { plan } : {}), ...(cancellation ?? {}) })
          .eq('id', clientId);
      }

      const cancellationChange = cancellation
        ? cancellation.cancelled_at ? 'scheduled' : 'cleared'
        : null;

      await admin.from('events').insert({
        client_id: clientId,
        type: 'stripe_customer.subscription.updated',
        metadata: {
          stripe_event_id: event.id,
          status: sub.status,
          plan,
          ...(cancellationChange ? { cancellation: cancellationChange } : {}),
        },
      });

      const { data: client } = await admin.from('clients').select('slug, custom_domain').eq('id', clientId).single();
      if (client) revalidateClientSite(client.slug, client.custom_domain);

      logFunnel({
        flow: 'stripe-webhook',
        event: 'ok',
        request_id,
        funnel_session_id,
        client_id: clientId,
        stripe_event: event.type,
        sub_status: sub.status,
        plan,
        cancellation: cancellationChange,
      });

      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const clientId = sub.metadata['client_id'];
      const funnel_session_id = sessionIdFromMetadata(sub.metadata);
      if (!clientId) break;

      // A client re-linked to a newer subscription can still have the old one
      // end later: skip the cancel, the commission void and the email.
      const { data: current } = await admin
        .from('clients')
        .select('stripe_subscription_id')
        .eq('id', clientId)
        .maybeSingle();
      if (isSupersededSubscription(sub.id, current?.stripe_subscription_id ?? null)) {
        await admin.from('events').insert({
          client_id: clientId,
          type: 'stripe_customer.subscription.deleted',
          metadata: { stripe_event_id: event.id, ignored: 'superseded', subscription_id: sub.id },
        });
        break;
      }

      // cancel_at is set when cancel_at_period_end=true; ended_at is the actual end
      const periodEndMs = (sub.cancel_at ?? sub.ended_at ?? Math.floor(Date.now() / 1000)) * 1000;
      const expiresAt = new Date(periodEndMs).toISOString();
      const hardDeleteAt = new Date(periodEndMs + 60 * 24 * 60 * 60 * 1000).toISOString();

      await admin.from('clients').update({
        cancelled_at: new Date().toISOString(),
        expires_at: expiresAt,
        hard_delete_at: hardDeleteAt,
      }).eq('id', clientId);

      // Void any commission_ledger rows that haven't vested yet. The 14-day
      // window on first invoices exists so a customer who bait-and-cancels
      // never produces a payable commission. Already-vested rows stay
      // pending and pay out normally — once it's vested, churn is fine.
      const { data: voided } = await admin
        .from('commission_ledger')
        .update({
          status: 'void',
          metadata: { void_reason: 'customer_cancelled_before_vest', stripe_event_id: event.id },
        })
        .eq('client_id', clientId)
        .eq('status', 'pending')
        .gt('vests_at', new Date().toISOString())
        .select('id, commission_cents');
      if (voided && voided.length > 0) {
        console.log('voided unvested commission rows', {
          client_id: clientId,
          count: voided.length,
          total_cents: voided.reduce((s, r) => s + r.commission_cents, 0),
        });
      }

      await admin.from('events').insert({
        client_id: clientId,
        type: 'stripe_customer.subscription.deleted',
        metadata: {
          stripe_event_id: event.id,
          expires_at: expiresAt,
          hard_delete_at: hardDeleteAt,
          voided_commission_rows: voided?.length ?? 0,
        },
      });

      const { data: client } = await admin.from('clients').select('slug, custom_domain').eq('id', clientId).single();
      if (client) revalidateClientSite(client.slug, client.custom_domain);

      // Cancellation email — non-fatal
      try {
        await getEmailProvider().send({
          clientId,
          template: 'cancellation_confirmation',
          variables: {
            expires_at: new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            hard_delete_at: new Date(hardDeleteAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            reactivation_url: `https://${platformDomain}/portal`,
          },
        });
      } catch {
        console.error('cancellation email failed', { client_id: clientId });
      }

      logFunnel({
        flow: 'stripe-webhook',
        event: 'ok',
        request_id,
        funnel_session_id,
        client_id: clientId,
        stripe_event: event.type,
        expires_at: expiresAt,
      });

      break;
    }

    case 'invoice.paid': {
      // Commission accrual. Every paid invoice for a rep-attributed,
      // commission-eligible plan inserts one ledger row. The unique index
      // on stripe_invoice_id is the idempotency guard — replaying this
      // event (Stripe retries / our own ops re-deliveries) is a no-op.
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : null;
      if (!customerId) break;

      const { data: client } = await admin
        .from('clients')
        .select('id, plan, sales_rep_id, funnel_session_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle();
      if (!client || !client.sales_rep_id) break;
      if (!isCommissionEligiblePlan(client.plan)) break;

      const { data: rep } = await admin
        .from('sales_reps')
        .select('commission_pct, status')
        .eq('id', client.sales_rep_id)
        .single();
      // Accrue even for disabled/pending reps so reactivation doesn't lose
      // history; admin can void rows from the ledger if needed.
      const pct = rep?.commission_pct ?? 50;

      // Use amount_paid (what was actually collected) not amount_due. For a
      // typical monthly subscription invoice both match, but in proration /
      // credit cases amount_paid is the authoritative number.
      const grossCents = invoice.amount_paid ?? 0;
      const commissionCents = commissionCentsFromGross(grossCents, pct);

      // Vesting: only the FIRST invoice waits 14 days. billing_reason
      // 'subscription_create' marks the first invoice on a new subscription;
      // anything else (subscription_cycle, subscription_update, manual) is a
      // renewal — the customer already passed the bait-and-cancel filter
      // last cycle, so renewals vest immediately.
      const isFirstInvoice = invoice.billing_reason === 'subscription_create';
      const VEST_WAIT_DAYS = 14;
      const vestsAt = isFirstInvoice
        ? new Date(Date.now() + VEST_WAIT_DAYS * 24 * 60 * 60 * 1000).toISOString()
        : new Date().toISOString();

      if (grossCents > 0) {
        const { error: ledgerErr } = await admin
          .from('commission_ledger')
          .insert({
            sales_rep_id: client.sales_rep_id,
            client_id: client.id,
            stripe_invoice_id: invoice.id ?? `evt_${event.id}`,
            gross_cents: grossCents,
            commission_pct: pct,
            commission_cents: commissionCents,
            currency: invoice.currency ?? 'usd',
            status: 'pending',
            vests_at: vestsAt,
            metadata: {
              stripe_event_id: event.id,
              billing_reason: invoice.billing_reason ?? null,
              period_start: invoice.period_start ?? null,
              period_end: invoice.period_end ?? null,
              first_invoice: isFirstInvoice,
            },
          });
        // Duplicate insert (replay) is fine — the unique index returns 23505;
        // any other error gets logged but doesn't fail the webhook.
        if (ledgerErr && ledgerErr.code !== '23505') {
          console.error('commission_ledger insert failed', {
            client_id: client.id,
            error: ledgerErr.message,
          });
        }
      }

      await admin.from('events').insert({
        client_id: client.id,
        type: 'stripe_invoice.paid',
        metadata: {
          stripe_event_id: event.id,
          gross_cents: grossCents,
          commission_cents: commissionCents,
          sales_rep_id: client.sales_rep_id,
        },
      });

      logFunnel({
        flow: 'stripe-webhook',
        event: 'ok',
        request_id,
        funnel_session_id: client.funnel_session_id,
        client_id: client.id,
        stripe_event: event.type,
        commission_cents: commissionCents,
        sales_rep_id: client.sales_rep_id,
      });

      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;

      // Invoice events don't carry our metadata, so look up the client +
      // session_id from the stripe customer mapping.
      let clientId: string | null = null;
      let funnel_session_id: string | null = null;
      if (customerId) {
        const { data } = await admin
          .from('clients')
          .select('id, funnel_session_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();
        clientId = data?.id ?? null;
        funnel_session_id = data?.funnel_session_id ?? null;
      }

      await admin.from('events').insert({
        client_id: clientId,
        type: 'stripe_invoice.payment_failed',
        metadata: {
          stripe_event_id: event.id,
          amount_due: invoice.amount_due,
          stripe_customer: customerId,
        },
      });

      if (clientId) {
        // Prefer Stripe's hosted invoice page: a durable, no-login URL where the
        // customer pays the past-due invoice and updates their card in one step
        // (settling it immediately instead of waiting for the next retry). Fall
        // back to our portal only if Stripe didn't provide one — that path makes
        // them log in first, so it's the worse experience we avoid when we can.
        const billing_url = invoice.hosted_invoice_url
          ?? `https://${platformDomain}/portal/billing`;
        try {
          await getEmailProvider().send({
            clientId,
            template: 'payment_failed',
            variables: { billing_url },
          });
        } catch {
          console.error('payment_failed email failed', { client_id: clientId });
        }
      }

      try {
        await sendAdminAlert({
          subject: `⚠️ Payment failed — ${customerId}`,
          html: `<p>Invoice payment failed for Stripe customer ${customerId}. Client ID: ${clientId ?? 'unknown'}.</p>`,
        });
      } catch {
        console.error('payment_failed admin alert failed', { client_id: clientId, customer_id: customerId });
      }

      logFunnel({
        flow: 'stripe-webhook',
        event: 'error',
        request_id,
        funnel_session_id,
        client_id: clientId,
        stripe_event: event.type,
        error: 'payment_failed',
        stripe_customer: customerId ?? null,
      });

      break;
    }

    default:
      // Unknown event type — log and return 200 to prevent Stripe retries
      console.log('Unhandled Stripe event type', event.type);
  }

  return NextResponse.json({ received: true });
}

// ============================================================================
// Operator alert formatting — varies by auto-provisioning outcome.
// ============================================================================

function subjectForProvisionResult(
  domainChoice: 'have' | 'need',
  domain: string,
  result: ProvisionResult | null,
): string {
  if (domainChoice === 'have') return `🟢 New claim — point ${domain} at us`;
  if (!result || result.status === 'skipped') {
    return `🟢 New claim — register ${domain}`;
  }
  if (result.status === 'success') {
    return result.vercel_verified
      ? `✅ Auto-provisioned ${domain}`
      : `🟡 Auto-provisioned ${domain} — DNS propagating`;
  }
  return `🔴 Auto-provision failed — ${domain}`;
}

function alertHtmlForProvisionResult(opts: {
  businessName: string | null;
  clientId: string;
  checkoutEmail: string | null;
  domainChoice: 'have' | 'need';
  requestedDomain: string;
  adminUrl: string;
  provisionResult: ProvisionResult | null;
}): string {
  const {
    businessName,
    clientId,
    checkoutEmail,
    domainChoice,
    requestedDomain,
    adminUrl,
    provisionResult,
  } = opts;

  const header = `<p><strong>${businessName ?? clientId}</strong> just paid for the Starter plan.</p>
    <ul>
      <li>Domain choice: <strong>${domainChoice}</strong></li>
      <li>Requested domain: <strong>${requestedDomain}</strong></li>
      <li>Customer email: ${checkoutEmail ?? '(unknown)'}</li>
      <li>Client ID: ${clientId}</li>
    </ul>
    <p><a href="${adminUrl}">Open client in admin →</a></p>`;

  // 'have' branch is unchanged: customer brought their own domain, we just
  // need to point Vercel at it and send DNS instructions.
  if (domainChoice === 'have') {
    return (
      header +
      `<p>Next: configure the custom domain in Vercel, send the customer DNS ` +
      `instructions, then click "Send welcome email" once it resolves.</p>`
    );
  }

  // 'need' branch with feature flag off or config missing — same manual queue
  // behavior as before.
  if (!provisionResult || provisionResult.status === 'skipped') {
    const reason =
      provisionResult?.status === 'skipped'
        ? `<p style="color:#888"><em>Auto-registration skipped: ${provisionResult.reason}</em></p>`
        : '';
    return (
      header +
      reason +
      `<p>Next: register the domain in Namecheap, point nameservers to ` +
      `<code>ns1.vercel-dns.com</code> + <code>ns2.vercel-dns.com</code>, ` +
      `then click "Add to Vercel" in admin.</p>`
    );
  }

  if (provisionResult.status === 'success') {
    const charged = provisionResult.charged_amount_usd;
    const chargeLine =
      charged !== null ? `<li>Charged: $${charged.toFixed(2)}</li>` : '';
    if (provisionResult.vercel_verified) {
      return (
        header +
        `<p>✅ Domain auto-registered and verified. No further action needed.</p>
         <ul>${chargeLine}<li>Domain: <strong>${provisionResult.domain}</strong></li></ul>`
      );
    }
    return (
      header +
      `<p>🟡 Domain registered. Nameservers set to Vercel. DNS is still propagating — ` +
      `Vercel will provision the cert automatically within ~30 minutes. Click ` +
      `<strong>Re-verify</strong> in the admin Domain card to check status.</p>
       <ul>${chargeLine}<li>Domain: <strong>${provisionResult.domain}</strong></li></ul>`
    );
  }

  // Failure — surface which step blew up and what to do next.
  const { step, error, domain_registered, charged_amount_usd, details } =
    provisionResult;
  const detailsLine = details
    ? `<li>Details: <code>${JSON.stringify(details)}</code></li>`
    : '';
  const registeredLine = domain_registered
    ? `<li>⚠️ Domain <strong>was purchased</strong>${
        charged_amount_usd !== null ? ` ($${charged_amount_usd.toFixed(2)})` : ''
      } — don't re-buy.</li>`
    : `<li>Domain was not purchased — buy manually in Namecheap.</li>`;

  const nextSteps =
    step === 'price_check'
      ? `Manual fallback: register in Namecheap if it makes sense, then click "Add to Vercel" in admin.`
      : step === 'register'
      ? `Buy ${requestedDomain} manually in Namecheap, set NS to ns1/ns2.vercel-dns.com, then click "Add to Vercel" in admin.`
      : step === 'nameservers'
      ? `In Namecheap, set NS for ${requestedDomain} to ns1.vercel-dns.com + ns2.vercel-dns.com, then click "Add to Vercel" in admin.`
      : step === 'vercel_attach'
      ? `Open Vercel → Project → Domains and add ${requestedDomain} manually, then update the client's custom_domain in admin.`
      : `Domain bought and DNS set, but DB update failed. Set custom_domain=${requestedDomain}, domain_owner=platform on the client row.`;

  return (
    header +
    `<p>🔴 <strong>Auto-provisioning failed at step: ${step}</strong></p>
     <ul>
       <li>Error: <code>${error}</code></li>
       ${registeredLine}
       ${detailsLine}
     </ul>
     <p><strong>Manual fix:</strong> ${nextSteps}</p>`
  );
}
