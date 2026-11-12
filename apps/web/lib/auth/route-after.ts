// Post-authentication routing — shared between /auth/callback (legacy PKCE
// code exchange) and /auth/confirm (token-hash verifyOtp, the prefetch-
// resistant magic-link path). Both end with a signed-in user and need to
// drop them on the right destination based on context.
//
// Inputs are pre-parsed (nextPath + claimToken) so the two callers can
// parse the email-template-encoded {{ .RedirectTo }} however they need.

import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getDefaultCommissionPct } from '@/lib/platform-settings';
import { sendRepWelcomeEmail, sendAdminAlert } from '@/lib/email';

export type AuthRoutingInput = {
  origin: string;
  user: User;
  nextPath: string | null;
  claimToken: string | null;
};

export async function routeAuthenticatedUser(input: AuthRoutingInput): Promise<NextResponse> {
  const { origin, user, nextPath, claimToken } = input;

  // Claim flow — magic link came from the claim wizard and carries a
  // claim_token. Bind the unclaimed client to the new user, then drop them
  // on onboarding to pick a plan + domain.
  if (claimToken) {
    const admin = createServiceRoleClient();
    const { data: client } = await admin
      .from('clients')
      .select('id')
      .eq('claim_token', claimToken)
      .is('owner_user_id', null)
      .single();
    if (client) {
      await admin
        .from('clients')
        .update({ owner_user_id: user.id })
        .eq('id', client.id);
      await admin.from('events').insert({
        client_id: client.id,
        user_id: user.id,
        type: 'claim',
        metadata: { email_hash: Buffer.from(user.email ?? '').toString('base64') },
      });
    }
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  // Admin always wins — even if ?next pointed elsewhere.
  if (user.email === process.env.ADMIN_EMAIL) {
    return NextResponse.redirect(`${origin}/admin`);
  }

  // Rep / affiliate flow — anything under /reps (active outreach reps) or
  // /affiliates (passive link-sharers). Both end up in the same dashboard;
  // the kind column drives UI visibility + signup defaults.
  //
  //   /reps        → kind='rep', status='pending' (you approve manually),
  //                  commission_pct=50.
  //   /affiliates  → kind='affiliate', status='active' (self-serve),
  //                  commission_pct=30.
  //
  // Defaults are signup-time values. Admin can override per-rep from
  // /admin/reps (the Rate column is an inline-editable input).
  //
  // Returning users keep their existing kind/status regardless of which
  // login URL they came in through — we don't downgrade reps to affiliates
  // or vice-versa.
  if (
    nextPath &&
    (nextPath.startsWith('/reps') || nextPath.startsWith('/affiliates'))
  ) {
    const isAffiliateSignup = nextPath.startsWith('/affiliates');
    const admin = createServiceRoleClient();
    const { data: existing } = await admin
      .from('sales_reps')
      .select('id, status, kind')
      .eq('user_id', user.id)
      .maybeSingle();
    let status = existing?.status ?? null;
    if (!existing) {
      const localPart = (user.email ?? 'rep').split('@')[0] ?? 'rep';
      const baseCode = localPart
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 24)
        .padEnd(3, 'x');
      const code = `${baseCode}-${crypto.randomUUID().slice(0, 4)}`;
      // Default commission % is admin-tunable from /admin/settings. Reads
      // platform_settings.{affiliate,rep}_default_commission_pct.
      const commissionPct = await getDefaultCommissionPct(
        isAffiliateSignup ? 'affiliate' : 'rep',
        admin,
      );
      await admin.from('sales_reps').insert({
        user_id: user.id,
        email: user.email ?? null,
        code,
        kind: isAffiliateSignup ? 'affiliate' : 'rep',
        status: isAffiliateSignup ? 'active' : 'pending',
        commission_pct: commissionPct,
        approved_at: isAffiliateSignup ? new Date().toISOString() : null,
      });
      status = isAffiliateSignup ? 'active' : 'pending';

      // Fire-and-forget welcome email. Failure logs but doesn't block the
      // redirect — user can find their dashboard regardless.
      if (user.email) {
        sendRepWelcomeEmail({
          to: user.email,
          kind: isAffiliateSignup ? 'affiliate' : 'rep',
          status: isAffiliateSignup ? 'active' : 'pending',
          code,
          commissionPct,
        }).catch((err) =>
          console.error('rep welcome email failed', {
            user_id: user.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }

      // Fire-and-forget admin alert so you know someone signed up. Affiliate
      // signups are self-serve (no admin action needed) but the heads-up is
      // useful for spotting fraud / fake email patterns / sudden traffic.
      // Rep signups need your approval before they unlock, so the alert
      // doubles as your action item.
      const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
      const proto = platformDomain.startsWith('localhost') ? 'http' : 'https';
      const adminLink = `${proto}://${platformDomain}/admin/reps`;
      const kindLabel = isAffiliateSignup ? 'Affiliate' : 'Sales rep';
      const statusLine = isAffiliateSignup
        ? '<strong style="color:#16a34a;">Auto-active</strong> — no action needed.'
        : '<strong style="color:#d97706;">Pending approval</strong> — visit /admin/reps to approve.';
      sendAdminAlert({
        subject: `🎯 New ${kindLabel.toLowerCase()} signup: ${user.email ?? '(no email)'}`,
        html: `
          <p><strong>${kindLabel}</strong> just signed up.</p>
          <ul>
            <li>Email: ${user.email ?? '(no email)'}</li>
            <li>Code: <code>${code}</code></li>
            <li>Commission: ${commissionPct}%</li>
            <li>Status: ${statusLine}</li>
          </ul>
          <p><a href="${adminLink}">Open /admin/reps →</a></p>
        `,
      }).catch((err) =>
        console.error('rep signup admin alert failed', {
          user_id: user.id,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
    if (status === 'active') return NextResponse.redirect(`${origin}/reps`);
    if (status === 'disabled') return NextResponse.redirect(`${origin}/reps/disabled`);
    return NextResponse.redirect(`${origin}/reps/pending`);
  }

  // Generic safe-redirect: only honor same-origin relative paths. Anything
  // we don't recognize falls back to /portal.
  if (nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//')) {
    return NextResponse.redirect(`${origin}${nextPath}`);
  }

  return NextResponse.redirect(`${origin}/portal`);
}

// Parse the email-template-substituted `next` URL string into the bits
// routeAuthenticatedUser actually needs. The template sets `next` from
// `{{ .RedirectTo }}`, which is whatever the sign-in code passed as
// `options.emailRedirectTo` — a fully qualified URL when set client-side.
//
// Today's sign-in code points emailRedirectTo at /auth/callback?next=…
// (the legacy PKCE handler) so the existing flow keeps working. When the
// Supabase template gets flipped to /auth/confirm, we receive that same
// URL here and need to unwrap it: pathname is /auth/callback (not a real
// destination) but its searchParams carry the actual next + claim_token.
//
// Returns { nextPath, claimToken }. nextPath is null when the URL is
// missing, malformed, or off-origin.
export function parseNextUrl(
  next: string | null,
  origin: string,
): { nextPath: string | null; claimToken: string | null } {
  if (!next) return { nextPath: null, claimToken: null };
  try {
    const parsed = new URL(next, origin);
    // Reject off-origin destinations — Supabase already allowlists
    // emailRedirectTo, but defense in depth: a leaked link shouldn't be
    // able to bounce a verified session to an attacker's site.
    if (parsed.origin !== origin) {
      return { nextPath: null, claimToken: null };
    }
    // /auth/callback URLs are wrappers — unwrap to the real destination.
    if (parsed.pathname === '/auth/callback') {
      return {
        nextPath: parsed.searchParams.get('next'),
        claimToken: parsed.searchParams.get('claim_token'),
      };
    }
    return {
      nextPath: parsed.pathname,
      claimToken: parsed.searchParams.get('claim_token'),
    };
  } catch {
    return { nextPath: null, claimToken: null };
  }
}
