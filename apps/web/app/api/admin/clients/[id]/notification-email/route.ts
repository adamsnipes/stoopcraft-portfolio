import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

// Set (or clear) where this client's website form submissions are emailed.
// Decoupled from the portal account on purpose — see the contact route and the
// notification_email migration. An empty string clears it (falls back to the
// owner's account email).
const inputSchema = z.object({
  notification_email: z.string().email().max(200).or(z.literal('')),
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

  const trimmed = parsed.data.notification_email.trim();
  const value = trimmed === '' ? null : trimmed;

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('clients')
    .update({ notification_email: value })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, notification_email: value });
}
