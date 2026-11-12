import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

const inputSchema = z.object({
  business_name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await getAuthenticatedRep();
  if (!ctx || ctx.rep.status !== 'active') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (ctx.rep.kind === 'affiliate') {
    return NextResponse.json({ error: 'reps_only' }, { status: 403 });
  }

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
  const { data, error } = await admin
    .from('rep_leads')
    .insert({
      sales_rep_id: ctx.rep.id,
      business_name: parsed.data.business_name,
      phone: parsed.data.phone ? parsed.data.phone : null,
      email: parsed.data.email ? parsed.data.email : null,
      notes: parsed.data.notes ? parsed.data.notes : null,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  }

  return NextResponse.json({ lead: data });
}
