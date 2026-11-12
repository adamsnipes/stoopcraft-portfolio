import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

// Toggle application-email test mode for a client. When on, /api/application
// routes each submitted application PDF to the ops inbox (ADMIN_EMAIL) instead
// of the client owner — for verifying the flow before go-live. Scoped to the
// application endpoint; lead emails are unaffected. Turn off to deliver to the
// owner. Admin-only.
const inputSchema = z.object({
  application_test_mode: z.boolean(),
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

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('clients')
    .update({ application_test_mode: parsed.data.application_test_mode })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, application_test_mode: parsed.data.application_test_mode });
}
