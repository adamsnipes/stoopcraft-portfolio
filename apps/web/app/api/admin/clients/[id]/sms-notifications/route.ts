import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { normalizeUsPhone } from '@/lib/sms';

type RouteContext = { params: Promise<{ id: string }> };

// Set the SMS-lead-notification upsell for a client: whether they've purchased
// it (enabled) and where the texts go (notification_phone). Both are admin-only
// — enabled is the paid gate, flipped on ONLY after purchase (see the
// sms_notifications migration and app/api/contact). An empty phone clears it.
const inputSchema = z.object({
  sms_notifications_enabled: z.boolean(),
  notification_phone: z.string().max(30),
});

async function assertAdmin(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return user.email === process.env.ADMIN_EMAIL ? user.email : null;
}

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
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed', details: parsed.error.issues }, { status: 400 });
  }

  // Normalize to E.164 so the contact route can text it as-is. An empty string
  // clears the number; a non-empty value that isn't a valid US number is rejected.
  const rawPhone = parsed.data.notification_phone.trim();
  let notification_phone: string | null = null;
  if (rawPhone !== '') {
    const normalized = normalizeUsPhone(rawPhone);
    if (!normalized) {
      return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
    }
    notification_phone = normalized;
  }

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('clients')
    .update({
      sms_notifications_enabled: parsed.data.sms_notifications_enabled,
      notification_phone,
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    sms_notifications_enabled: parsed.data.sms_notifications_enabled,
    notification_phone,
  });
}
