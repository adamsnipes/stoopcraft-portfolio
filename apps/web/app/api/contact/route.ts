import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getEmailProvider, escapeHtml, renderTemplate } from '@/lib/email';
import { clientDisplayName } from '@/lib/client-display';
import { CHEAP_BRAND, cheapPreviewSlug, isCheapBrandClient } from '@/lib/marketing-brand';
import { sendCheapBrandLeadEmail } from '@/lib/email/cheap-brand';
import { sendSms, normalizeUsPhone, isSmsConfigured } from '@/lib/sms';

// Direct Resend send to an explicit address. The EmailProvider is intentionally
// clientId/owner-locked (never accepts a raw address), so the notification_email
// path — which may have no owner yet on a pre-purchase site — sends directly
// here instead. The notification is PURELY informational: no replyTo and no
// action buttons — we just hand the business the submitted lead details and
// they follow up themselves, outside our system. Best-effort: no key logs/no-op.
async function sendLeadToAddress(
  to: string,
  businessName: string,
  variables: { name: string; message: string; email_row_html: string; phone_row_html: string },
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'notifications@stoopcraft.com';
  if (!apiKey) {
    console.info('contact notification_email (no RESEND_API_KEY, not sent):', { to, ...variables });
    return;
  }
  const { subject, html } = renderTemplate('contact_form_lead', { business_name: businessName, ...variables });
  const resend = new Resend(apiKey);
  await resend.emails.send({ from, to, subject, html });
}

async function ownerEmail(admin: ReturnType<typeof createServiceRoleClient>, ownerUserId: string | null): Promise<string | null> {
  if (!ownerUserId) return null;
  const { data } = await admin.auth.admin.getUserById(ownerUserId);
  return data.user?.email ?? null;
}

// Retry a best-effort send a few times with exponential backoff. Leads aren't
// stored, so delivery is the only safety net — a transient Resend hiccup (blip,
// rate limit, 5xx) shouldn't drop a lead. Worst case adds ~1.2s before bailing.
async function withRetry(fn: () => Promise<unknown>, attempts = 3): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await fn();
      return;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw lastErr;
}

// Two clients hit this endpoint:
//   1. ContactForm.tsx (salon/restaurant) — requires `message`.
//   2. LeadForm.tsx    (trades hero)      — message is optional; the lead is
//      meaningful with just name + phone. `email` is collected when present,
//      `website` is a honeypot (must be empty), `source` tags the origin so
//      admin emails can distinguish a contact-form note from a hero lead.
const schema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(120).optional().or(z.literal('')),
  message: z.string().max(2000).optional(),
  source: z.enum(['contact_form', 'lead_hero']).optional(),
  // Static (R2-served) client sites can't be identified by the Host header —
  // they post cross-origin to the platform — so they declare their own host.
  // Same-origin template sites omit it and fall back to the Host header.
  site_host: z.string().max(255).optional(),
  // Honeypot — real visitors leave this empty. Bots fill every input.
  website: z.string().max(0).optional().or(z.literal('')),
});

// Static sites (served from R2, a different origin than this API) post here
// cross-origin. Wildcard CORS is fine: this is an unauthenticated, no-cookie
// public lead endpoint. Shared by every static client site via /lead-capture.js.
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: CORS });
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Parse the body first — static sites identify themselves via body.site_host.
  let rawBody: Record<string, unknown>;
  try {
    const ct = req.headers.get('content-type') ?? '';
    if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const form = await req.formData();
      rawBody = Object.fromEntries(form.entries()) as Record<string, unknown>;
    } else {
      rawBody = await req.json() as Record<string, unknown>;
    }
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ error: 'validation_failed' }, 400);
  }

  // Honeypot — fake success to bots so they don't probe further.
  if (parsed.data.website) {
    return json({ success: true });
  }

  const { name, phone, email, message, source, site_host } = parsed.data;

  // Resolve which client this lead belongs to. site_host (sent by static sites)
  // wins over the Host header (template sites post same-origin). Strip the port
  // and a leading `www.` so apex and www resolve to the same client — and so it
  // works identically before and after the domain is flipped to the client's own.
  const platformDomain = process.env.PLATFORM_DOMAIN ?? '';
  const rawHost = ((site_host || req.headers.get('host') || '').split(':')[0] ?? '').toLowerCase();
  const host = rawHost.replace(/^www\./, '');
  // <slug>.stupidcheapwebsites.com resolves only that brand's clients.
  const brandSlug = cheapPreviewSlug(host);
  const isSubdomain = !!platformDomain && host.endsWith('.' + platformDomain);
  const slug = brandSlug ?? (isSubdomain ? host.replace('.' + platformDomain, '') : null);

  const admin = createServiceRoleClient();
  const cols = 'id, business_name, slug, custom_domain, owner_user_id, status, notification_email, notification_phone, sms_notifications_enabled, brand';
  const { data: client } = await (brandSlug
    ? admin.from('clients').select(cols).eq('slug', brandSlug).eq('brand', CHEAP_BRAND.id).single()
    : slug
      ? admin.from('clients').select(cols).eq('slug', slug).single()
      : admin.from('clients').select(cols).eq('custom_domain', host).single()
  );

  if (!client) {
    return json({ error: 'not_found' }, 404);
  }

  // Normally only claimed sites receive form submissions. Exception: an operator
  // can set notification_email on a still-`live` (pre-purchase) site so a
  // prospect can watch their forms deliver real leads while evaluating.
  const serviceable =
    client.status === 'claimed' ||
    (!!client.notification_email && client.status === 'live');
  if (!serviceable) {
    return json({ error: 'not_found' }, 404);
  }
  const isLeadHero = source === 'lead_hero';
  // We deliberately do NOT persist website leads — they're emailed to the
  // business and that's the end of it. The portal is not a lead inbox / CRM
  // (avoids the data-liability of holding their customers' details). Change
  // requests (source='portal', via /api/portal/request) are still stored.
  const effectiveMessage = (message ?? '').trim() || (
    isLeadHero ? 'Lead from website — wants a free estimate.' : '(no message)'
  );

  const rowCell = (label: string, value: string) =>
    `<tr><td style="width:80px;padding:12px 16px;background-color:#fafafa;font-weight:600;color:#52525b;border-bottom:1px solid #e4e4e7;vertical-align:top;">${label}</td><td style="padding:12px 16px;border-bottom:1px solid #e4e4e7;color:#18181b;">${escapeHtml(value)}</td></tr>`;
  const emailRowHtml = email ? rowCell('Email', email) : '';
  const phoneRowHtml = phone ? rowCell('Phone', phone) : '';

  const variables = {
    name,
    message: effectiveMessage,
    email_row_html: emailRowHtml,
    phone_row_html: phoneRowHtml,
  };
  // notification_email (admin-set) → send directly; else the owner's account
  // email via the clientId-locked provider. Retry on transient failure.
  const notify = client.notification_email;
  const displayName = clientDisplayName(client);
  // Brand clients get the lead from the brand's own Resend account, never
  // StoopCraft's — the business must never see the platform behind the brand.
  const deliver = isCheapBrandClient(client.brand)
    ? async () => {
        const to = notify ?? await ownerEmail(admin, client.owner_user_id);
        if (!to) throw new Error('no lead recipient');
        await sendCheapBrandLeadEmail({ to, businessName: displayName, lead: { name, email, phone, message: effectiveMessage } });
      }
    : notify
      ? () => sendLeadToAddress(notify, displayName, variables)
      : () => getEmailProvider().send({ clientId: client.id, template: 'contact_form_lead', variables });

  try {
    await withRetry(deliver);
  } catch (err) {
    console.error('contact lead email failed after retries', {
      client_id: client.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // SMS is a PAID UPSELL, gated per client (see the sms_notifications migration).
  // Fire only when the client bought the add-on (sms_notifications_enabled), has
  // a valid destination number, and Twilio is configured — otherwise we'd incur
  // spend / errors for clients who never purchased it. Email above is the primary
  // channel; the text is a best-effort nudge, so it runs post-response via after()
  // and never blocks or fails the request.
  const smsTo = client.sms_notifications_enabled && client.notification_phone
    ? normalizeUsPhone(client.notification_phone)
    : null;
  if (smsTo && isSmsConfigured()) {
    // Keep it to ~1 segment. Lead through with the name + how to reach them;
    // the full details are already in the email.
    const contact = phone || email || '';
    const body = [
      `New lead for ${displayName}:`,
      name + (contact ? ` (${contact})` : ''),
      effectiveMessage.slice(0, 200),
    ].join('\n');
    after(async () => {
      const res = await sendSms({ to: smsTo, body });
      if (!res.ok) {
        console.error('contact lead sms failed', { client_id: client.id, err: res.error });
      }
    });
  }

  return json({ success: true });
}
