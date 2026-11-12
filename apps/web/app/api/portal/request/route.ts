import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedClient } from '@/lib/tenant';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getEmailProvider, sendAdminAlert, escapeHtml } from '@/lib/email';

const schema = z.object({
  body: z.string().min(10).max(2000),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // client_id derived from session — NEVER from request body
  const ctx = await getAuthenticatedClient();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  const { error } = await admin.from('requests').insert({
    client_id: ctx.client.id,   // derived from session
    source: 'portal',
    body: parsed.data.body,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'stoopcraft.com';

  try {
    await getEmailProvider().send({
      clientId: ctx.client.id,
      template: 'request_submitted',
      variables: {
        body: parsed.data.body,
        portal_url: `https://${platformDomain}/portal`,
      },
    });
  } catch {
    console.error('request_submitted email failed', { client_id: ctx.client.id });
  }

  try {
    await sendAdminAlert({
      subject: `New change request — ${ctx.client.business_name}`,
      html: `<p><strong>${escapeHtml(ctx.client.business_name)}</strong> submitted a change request:</p><blockquote style="border-left:3px solid #e5e7eb;margin:16px 0;padding:8px 16px;color:#374151;">${escapeHtml(parsed.data.body)}</blockquote>`,
    });
  } catch {
    console.error('admin alert email failed', { client_id: ctx.client.id });
  }

  return NextResponse.json({ success: true });
}
