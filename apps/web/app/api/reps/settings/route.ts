// Rep self-service for payout destination. They pick PayPal or Venmo and
// give us where to send the money. Admin's "Mark as paid" button on
// /admin/payouts is gated on this — no destination, no payout. This API
// is the only path that writes payout_method / payout_destination from
// outside the service role; the rep can update their own row but not
// touch commission_pct / status / kind / etc.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';
import { createServiceRoleClient } from '@/lib/supabase/server';

// Venmo handle: 5-30 chars, alphanumeric + dot/dash/underscore. Strip the
// leading @ if the rep typed one.
const VENMO_RE = /^[a-zA-Z0-9._-]{5,30}$/;

const inputSchema = z
  .object({
    payout_method: z.enum(['paypal', 'venmo']),
    payout_destination: z.string().trim().min(1).max(200),
  })
  .refine(
    (data) => {
      if (data.payout_method === 'paypal') {
        return z.string().email().safeParse(data.payout_destination).success;
      }
      const handle = data.payout_destination.replace(/^@/, '');
      return VENMO_RE.test(handle);
    },
    { message: 'destination_invalid_for_method' },
  );

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const ctx = await getAuthenticatedRep();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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

  // Normalize Venmo handles — strip leading @ so admin doesn't have to
  // think about it when copying into the Venmo app.
  const destination =
    parsed.data.payout_method === 'venmo'
      ? parsed.data.payout_destination.replace(/^@/, '')
      : parsed.data.payout_destination.trim();

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from('sales_reps')
    .update({
      payout_method: parsed.data.payout_method,
      payout_destination: destination,
    })
    .eq('id', ctx.rep.id);

  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ success: true });
}
