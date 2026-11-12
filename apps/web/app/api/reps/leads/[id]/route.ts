import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  business_name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(['contacted', 'interested', 'converted', 'dead']).optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const ctx = await getAuthenticatedRep();
  if (!ctx || ctx.rep.status !== 'active') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  // Scoped update: only the row that belongs to the authenticated rep. The
  // sales_rep_id filter is what enforces ownership at the service-role level,
  // since service role bypasses RLS.
  const { data, error } = await admin
    .from('rep_leads')
    .update(parsed.data)
    .eq('id', id)
    .eq('sales_rep_id', ctx.rep.id)
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ lead: data });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const ctx = await getAuthenticatedRep();
  if (!ctx || ctx.rep.status !== 'active') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('rep_leads')
    .delete()
    .eq('id', id)
    .eq('sales_rep_id', ctx.rep.id);
  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  return NextResponse.json({ success: true });
}
