import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { escapeHtml } from '@/lib/email';
import { clientDisplayName } from '@/lib/client-display';
import { renderApplicationPdf } from '@/lib/application-pdf';

// Long-form application intake (e.g. driver applications). Unlike /api/contact
// (short leads, capped at 2000 chars, emailed as plain rows), this renders the
// full submission to a PDF and emails it to the client owner as an attachment.
// Like /api/contact it is cross-origin (static sites post here), unauthenticated,
// resolves the client by site_host, and does NOT persist the submission.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fieldSchema = z.object({
  q: z.string().min(1).max(300),
  a: z.string().max(4000),
});

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(160).optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  kind: z.string().max(80).optional(),
  referral_code: z.string().max(80).optional(),
  fields: z.array(fieldSchema).min(1).max(120),
  // Static (R2-served) sites post cross-origin and declare their own host.
  site_host: z.string().max(255).optional(),
  // Honeypot — real visitors leave this empty.
  website: z.string().max(0).optional().or(z.literal('')),
});

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
  let rawBody: Record<string, unknown>;
  try {
    rawBody = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    return json({ error: 'validation_failed' }, 400);
  }

  // Honeypot — fake success to bots.
  if (parsed.data.website) {
    return json({ success: true });
  }

  const { name, email, phone, kind, referral_code, fields, site_host } = parsed.data;

  // Resolve which client this belongs to (mirror /api/contact: site_host wins
  // over Host header; strip port + leading www so apex/www/temp/custom all map).
  const platformDomain = process.env.PLATFORM_DOMAIN ?? '';
  const rawHost = ((site_host || req.headers.get('host') || '').split(':')[0] ?? '').toLowerCase();
  const host = rawHost.replace(/^www\./, '');
  const isSubdomain = !!platformDomain && host.endsWith('.' + platformDomain);
  const slug = isSubdomain ? host.replace('.' + platformDomain, '') : null;

  const admin = createServiceRoleClient();
  const cols = 'id, business_name, slug, custom_domain, owner_user_id, status, notification_email, application_test_mode';
  const { data: client } = await (slug
    ? admin.from('clients').select(cols).eq('slug', slug).single()
    : admin.from('clients').select(cols).eq('custom_domain', host).single());

  if (!client) {
    return json({ error: 'not_found' }, 404);
  }

  // Same serviceability rule as /api/contact.
  const serviceable =
    client.status === 'claimed' ||
    (!!client.notification_email && client.status === 'live');
  if (!serviceable) {
    return json({ error: 'not_found' }, 404);
  }

  // Real destination: admin-set notification_email wins; otherwise the owner's
  // account email (looked up via the service role, never accepted from the client).
  let intended: string | null = client.notification_email ?? null;
  if (!intended && client.owner_user_id) {
    const { data } = await admin.auth.admin.getUserById(client.owner_user_id);
    intended = data?.user?.email ?? null;
  }
  if (!intended) {
    return json({ error: 'not_found' }, 404);
  }

  // Pre-launch testing: when application_test_mode is ON for this client (toggled
  // from the admin dashboard — no deploy needed), route the application to the ops
  // inbox (ADMIN_EMAIL) instead of the owner so the flow can be verified. Scoped to
  // this client's applications only; leads and other clients are unaffected. The
  // email is marked [TEST] and names the real recipient. Turn off to deliver to the owner.
  const ops = process.env.ADMIN_EMAIL?.trim();
  const isTest = client.application_test_mode === true && Boolean(ops);
  const to = isTest ? (ops as string) : intended;

  const displayName = clientDisplayName(client);
  const kindLabel = (kind && kind.trim()) || 'New Application';

  let pdf: Uint8Array;
  try {
    pdf = await renderApplicationPdf({
      businessName: displayName,
      kind: kindLabel,
      submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
      applicant: { name, email: email || undefined, phone: phone || undefined },
      referralCode: referral_code || undefined,
      fields,
    });
  } catch (err) {
    console.error('application pdf render failed', {
      client_id: client.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return json({ error: 'pdf_failed' }, 500);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'notifications@stoopcraft.com';
  if (!apiKey) {
    console.info('application email (no RESEND_API_KEY, not sent):', { to, kind: kindLabel, name });
    return json({ success: true });
  }

  const contact = [email, phone].filter(Boolean).join(' · ');
  const testBanner = isTest
    ? `<p style="background:#fff8e1;border:1px solid #E4A72B;border-radius:8px;padding:10px 12px;color:#7a5b00;margin:0 0 12px"><strong>TEST MODE.</strong> In production this application would be emailed to <strong>${escapeHtml(intended)}</strong>.</p>`
    : '';
  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;color:#18181b;line-height:1.6">` +
    testBanner +
    `<p>A new <strong>${escapeHtml(kindLabel)}</strong> was submitted for ${escapeHtml(displayName)}.</p>` +
    `<p><strong>Applicant:</strong> ${escapeHtml(name)}${contact ? ` &middot; ${escapeHtml(contact)}` : ''}</p>` +
    (referral_code ? `<p><strong>Referral code:</strong> ${escapeHtml(referral_code)}</p>` : '') +
    `<p>The full application is attached as a PDF.</p></div>`;
  const safe = name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'applicant';
  const filename = `application-${safe}.pdf`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      subject: `${isTest ? '[TEST] ' : ''}${kindLabel} — ${name}`,
      html,
      attachments: [{ filename, content: Buffer.from(pdf).toString('base64') }],
    });
    if (error) throw new Error(error.message ?? 'unknown');
  } catch (err) {
    console.error('application email failed', {
      client_id: client.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return json({ error: 'send_failed' }, 502);
  }

  return json({ success: true });
}
