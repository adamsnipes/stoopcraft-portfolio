import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';
import { searchPlacesByText } from '@/lib/places';

const inputSchema = z.object({
  textQuery: z.string().trim().min(2).max(200),
  address: z.string().trim().max(200).nullish(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ctx = await getAuthenticatedRep();
  if (!ctx || ctx.rep.status !== 'active') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  const places = await searchPlacesByText(
    parsed.data.textQuery,
    parsed.data.address ?? undefined,
  );
  return NextResponse.json({ places });
}
