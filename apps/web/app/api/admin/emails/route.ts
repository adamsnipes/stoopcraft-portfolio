import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { renderManualEmail, sendManualEmail } from '@/lib/email';
import { TEST_RECIPIENT } from '@/app/admin/emails/constants';

async function assertAdmin(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return user.email === process.env.ADMIN_EMAIL ? user.email : null;
}

// Deliberately permissive — the recipient is entered by an authenticated admin,
// so we only guard against obvious typos, not spoofing.
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const adminEmail = await assertAdmin();
  if (!adminEmail) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: {
    to?: unknown;
    subject?: unknown;
    body?: unknown;
    clientId?: unknown;
    test?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const isTest = payload.test === true;
  const subject = typeof payload.subject === 'string' ? payload.subject.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  const typedTo = typeof payload.to === 'string' ? payload.to.trim() : '';
  const clientId = typeof payload.clientId === 'string' && payload.clientId ? payload.clientId : null;

  if (!subject) return NextResponse.json({ error: 'subject_required' }, { status: 400 });
  if (!body) return NextResponse.json({ error: 'body_required' }, { status: 400 });

  // Test sends always go to the internal preview inbox, regardless of the To
  // field. Real sends go to the recipient the admin typed/selected.
  const recipient = isTest ? TEST_RECIPIENT : typedTo;
  if (!isTest && !isValidEmail(recipient)) {
    return NextResponse.json({ error: 'invalid_recipient' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const html = renderManualEmail(body);

  let status: 'sent' | 'failed' = 'sent';
  let resendId: string | null = null;
  let sendError: string | null = null;
  try {
    const { id } = await sendManualEmail({ to: recipient, subject, html });
    resendId = id;
  } catch (err) {
    status = 'failed';
    sendError = err instanceof Error ? err.message : 'unknown';
  }

  // Log every attempt — successes and failures — so the history reflects reality.
  await admin.from('admin_emails').insert({
    client_id: clientId,
    to_email: recipient,
    subject,
    body,
    is_test: isTest,
    status,
    resend_id: resendId,
    error: sendError,
    sent_by: adminEmail,
  });

  if (status === 'failed') {
    return NextResponse.json({ error: 'send_failed', detail: sendError }, { status: 502 });
  }

  return NextResponse.json({ ok: true, to: recipient, test: isTest });
}
