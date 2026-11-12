// Automated domain provisioning — runs after Stripe checkout for the
// "register domain for me" (domain_choice='need') flow. Behind a feature
// flag (ENABLE_AUTO_DOMAIN_REGISTRATION). When the flag is off, callers
// fall through to the existing manual admin-alert path unchanged.
//
// Steps (any failure short-circuits and surfaces in the admin alert; no
// DB mutation to custom_domain on failure so manual takeover is clean):
//   1. Price gate — re-check via /availability (proxy cached pricing).
//      Refuse > PRICE_CAP_USD even though the funnel already filtered.
//   2. Register — namecheap.domains.create via the proxy.
//   3. Nameservers — point at Vercel (ns1/ns2.vercel-dns.com) so Vercel
//      manages DNS records + cert.
//   4. Vercel attach — addDomainToVercel. Cert provisions in seconds when
//      NS propagation has reached Vercel's resolvers.
//   5. DB write — set custom_domain, domain_owner='platform', expires_at.
//
// On any step failure, custom_domain stays null and domain_owner stays
// 'client'. The admin alert tells the operator which step blew and what
// to do (usually: buy in Namecheap dashboard and click "Add to Vercel"
// in the admin UI).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@dfy/db';
import {
  checkDomainAvailability,
  registerDomain,
  registrantContactFromEnv,
  setNameservers,
} from '@/lib/namecheap';
import { addDomainToVercel } from '@/lib/vercel/domains';

// Belt-and-suspenders cap: the funnel already refuses > $20 in the
// /api/namecheap/check route, but we re-check at the moment of purchase
// in case pricing changed between availability check and checkout.
export const PRICE_CAP_USD = 20;

// Vercel-managed DNS nameservers. Set these on the domain at Namecheap;
// Vercel then owns DNS for the zone and auto-creates records.
const VERCEL_NAMESERVERS = ['ns1.vercel-dns.com', 'ns2.vercel-dns.com'];

export type ProvisionResult =
  | {
      status: 'skipped';
      reason:
        | 'feature_disabled'
        | 'missing_registrant_contact'
        | 'proxy_unconfigured';
    }
  | {
      status: 'success';
      domain: string;
      charged_amount_usd: number | null;
      vercel_verified: boolean;
    }
  | {
      status: 'failed';
      step: 'price_check' | 'register' | 'nameservers' | 'vercel_attach' | 'db_update';
      domain: string;
      // True once registration succeeded — admin alert can call out that
      // the domain *was* purchased but downstream steps need manual completion.
      domain_registered: boolean;
      charged_amount_usd: number | null;
      error: string;
      details?: Record<string, unknown>;
    };

export function autoRegistrationEnabled(): boolean {
  return process.env.ENABLE_AUTO_DOMAIN_REGISTRATION === 'true';
}

/**
 * Provision a domain on a customer's behalf. Caller should have already
 * validated `domainChoice === 'need'` and that `domain` is a plain .com.
 *
 * The function is intentionally tolerant of partial success: a registered-
 * but-not-attached domain is logged with `domain_registered: true` so the
 * operator alert can convey "we bought it, finish the rest manually" vs
 * "we never got to the purchase."
 */
export async function provisionDomain({
  admin,
  clientId,
  domain,
}: {
  admin: SupabaseClient<Database>;
  clientId: string;
  domain: string;
}): Promise<ProvisionResult> {
  if (!autoRegistrationEnabled()) {
    return { status: 'skipped', reason: 'feature_disabled' };
  }

  const contact = registrantContactFromEnv();
  if (!contact) {
    return { status: 'skipped', reason: 'missing_registrant_contact' };
  }

  if (!process.env.NAMECHEAP_PROXY_URL || !process.env.NAMECHEAP_PROXY_TOKEN) {
    return { status: 'skipped', reason: 'proxy_unconfigured' };
  }

  // === Step 1: price gate ====================================================
  const availability = await checkDomainAvailability(domain);
  if (!availability.configured) {
    return {
      status: 'failed',
      step: 'price_check',
      domain,
      domain_registered: false,
      charged_amount_usd: null,
      error: `availability_check_failed:${availability.reason}`,
    };
  }
  if (!availability.available || availability.premium) {
    return {
      status: 'failed',
      step: 'price_check',
      domain,
      domain_registered: false,
      charged_amount_usd: null,
      error: availability.premium ? 'premium_not_supported' : 'not_available',
    };
  }
  if (
    typeof availability.registration_price_usd === 'number' &&
    availability.registration_price_usd > PRICE_CAP_USD
  ) {
    return {
      status: 'failed',
      step: 'price_check',
      domain,
      domain_registered: false,
      charged_amount_usd: null,
      error: 'over_price_cap',
      details: {
        price_usd: availability.registration_price_usd,
        cap_usd: PRICE_CAP_USD,
      },
    };
  }

  // === Step 2: register ======================================================
  const reg = await registerDomain(domain, contact, 1);
  if (!reg.registered) {
    return {
      status: 'failed',
      step: 'register',
      domain,
      domain_registered: false,
      charged_amount_usd: null,
      error: reg.error,
      details: {
        namecheap_error_number: reg.namecheap_error_number ?? null,
        namecheap_error_message: reg.namecheap_error_message ?? null,
      },
    };
  }

  // Defense-in-depth: Namecheap returned a price > cap. This shouldn't
  // happen given the price-check pre-gate, but if it does we still recorded
  // the purchase — alert the operator with the actual charge so they can
  // decide whether to keep it or initiate a transfer-out.
  const chargedAmount = reg.charged_amount_usd;
  if (typeof chargedAmount === 'number' && chargedAmount > PRICE_CAP_USD) {
    console.warn('[domain-provisioning] charged amount exceeded cap', {
      domain,
      chargedAmount,
      cap: PRICE_CAP_USD,
    });
  }

  // === Step 3: nameservers ===================================================
  const ns = await setNameservers(domain, VERCEL_NAMESERVERS);
  if (!ns.updated) {
    return {
      status: 'failed',
      step: 'nameservers',
      domain,
      domain_registered: true,
      charged_amount_usd: chargedAmount,
      error: ns.error,
      details: {
        namecheap_error_number: ns.namecheap_error_number ?? null,
        namecheap_error_message: ns.namecheap_error_message ?? null,
      },
    };
  }

  // === Step 4: Vercel attach =================================================
  let vercelVerified = false;
  try {
    const vercel = await addDomainToVercel(domain);
    vercelVerified = vercel.verified;
  } catch (err) {
    // Don't unwind the registration — we've already paid. Surface to admin.
    return {
      status: 'failed',
      step: 'vercel_attach',
      domain,
      domain_registered: true,
      charged_amount_usd: chargedAmount,
      error: err instanceof Error ? err.message : 'vercel_attach_failed',
    };
  }

  // === Step 5: DB write ======================================================
  // Set custom_domain + mark us as the owner. expires_at = +1y (registrations
  // default to 1-year term; the domain-watch cron will refresh this on renewal).
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const { error: updateErr } = await admin
    .from('clients')
    .update({
      custom_domain: domain,
      domain_owner: 'platform',
      expires_at: oneYearFromNow.toISOString(),
    })
    .eq('id', clientId);

  if (updateErr) {
    return {
      status: 'failed',
      step: 'db_update',
      domain,
      domain_registered: true,
      charged_amount_usd: chargedAmount,
      error: updateErr.message,
    };
  }

  // Best-effort event log — non-fatal if it fails.
  await admin.from('events').insert({
    client_id: clientId,
    type: 'domain_auto_provisioned',
    metadata: {
      domain,
      charged_amount_usd: chargedAmount,
      vercel_verified: vercelVerified,
      nameservers: VERCEL_NAMESERVERS,
    },
  });

  return {
    status: 'success',
    domain,
    charged_amount_usd: chargedAmount,
    vercel_verified: vercelVerified,
  };
}
