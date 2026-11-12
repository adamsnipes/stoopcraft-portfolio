import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { renderTemplate } from '@/lib/email/templates';
import { sendManualEmail } from '@/lib/email';
import { assertAdmin } from '@/lib/gsc/admin-auth';
import { GscNotConfiguredError } from '@/lib/gsc/auth';
import { GscApiError } from '@/lib/gsc/client';
import { seoReportVariables } from '@/lib/gsc/email';
import { buildSeoReport, GscNotConnectedError } from '@/lib/gsc/report';

// GET  — build the report and render the exact email HTML, for admin preview.
// POST — send it, either to the admin as a test or to the client for real.
//
// There is no cron behind this yet, and that's deliberate: the operator eyeballs
// every report before it goes out while we learn what the numbers look like
// across the client base. Automating this is a matter of moving the POST body
// into a cron route once the hold-back rules are known.

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const DAYS_MIN = 7;
const DAYS_MAX = 480; // Search Console retains 16 months.

/**
 * Where a client's report goes. Prefers the portal account (the person who
 * pays), falling back to the lead-notification address for clients who never
 * claimed a login. Both come from the DB, never from request input.
 */
async function resolveRecipient(
  clientId: string,
): Promise<{ email: string; source: 'owner' | 'notification' } | null> {
  const admin = createServiceRoleClient();
  const { data: client } = await admin
    .from('clients')
    .select('owner_user_id, notification_email')
    .eq('id', clientId)
    .single();

  if (!client) return null;

  if (client.owner_user_id) {
    const { data } = await admin.auth.admin.getUserById(client.owner_user_id);
    if (data?.user?.email) return { email: data.user.email, source: 'owner' };
  }

  if (client.notification_email) return { email: client.notification_email, source: 'notification' };
  return null;
}

/** Maps the library's typed failures onto responses the admin UI can explain. */
function errorResponse(err: unknown): NextResponse {
  if (err instanceof GscNotConnectedError) {
    return NextResponse.json({ error: 'not_connected' }, { status: 400 });
  }
  if (err instanceof GscNotConfiguredError) {
    return NextResponse.json({ error: 'not_configured', detail: err.message }, { status: 503 });
  }
  if (err instanceof GscApiError) {
    return NextResponse.json({ error: 'gsc_error', detail: err.hint }, { status: 502 });
  }
  return NextResponse.json(
    { error: 'report_failed', detail: err instanceof Error ? err.message : String(err) },
    { status: 500 },
  );
}

export async function GET(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const daysParam = Number(req.nextUrl.searchParams.get('days'));
  const days = Number.isFinite(daysParam) && daysParam >= DAYS_MIN && daysParam <= DAYS_MAX ? daysParam : undefined;

  try {
    const report = await buildSeoReport(id, { days });
    const { subject, html } = renderTemplate('seo_report', seoReportVariables(report));
    const recipient = await resolveRecipient(id);
    return NextResponse.json({ report, subject, html, recipient });
  } catch (err) {
    return errorResponse(err);
  }
}

const sendSchema = z.object({
  mode: z.enum(['test', 'client']),
  days: z.number().int().min(DAYS_MIN).max(DAYS_MAX).optional(),
});

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const adminEmail = await assertAdmin();
  if (!adminEmail) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed', details: parsed.error.issues }, { status: 400 });
  }
  const { mode, days } = parsed.data;

  let report;
  try {
    report = await buildSeoReport(id, { days });
  } catch (err) {
    return errorResponse(err);
  }

  const { subject, html } = renderTemplate('seo_report', seoReportVariables(report));

  // Test sends go to whoever is logged into admin; real sends resolve from the
  // client row. Rebuilding the report here rather than trusting a client-posted
  // payload keeps the numbers in the email provably the ones from Google.
  let to = adminEmail;
  if (mode === 'client') {
    const recipient = await resolveRecipient(id);
    if (!recipient) {
      return NextResponse.json({ error: 'no_recipient' }, { status: 400 });
    }
    to = recipient.email;
  }

  try {
    await sendManualEmail({
      to,
      subject: mode === 'test' ? `[TEST] ${subject}` : subject,
      html,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'send_failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }

  // Logged for both modes so the admin page can show "last sent" and so a
  // future cron can skip anyone already reported on this month.
  const admin = createServiceRoleClient();
  await admin.from('events').insert({
    client_id: id,
    type: 'seo_report_sent',
    metadata: {
      to,
      is_test: mode === 'test',
      property: report.property,
      range: report.range,
      clicks: report.totals.clicks,
      impressions: report.totals.impressions,
      position: report.totals.position,
    },
  });

  return NextResponse.json({ ok: true, to, mode });
}
