import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

// Toggle the pre-sale "claim this site" banner for a client. The banner shows
// automatically on every unclaimed (status='live') template-site preview; set
// hide_claim_banner=true to suppress it — chiefly for demo/sample builds kept
// live for the portfolio, where there's no real prospect to bill.
const inputSchema = z.object({
  hide_claim_banner: z.boolean(),
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
    .update({ hide_claim_banner: parsed.data.hide_claim_banner })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, hide_claim_banner: parsed.data.hide_claim_banner });
}
