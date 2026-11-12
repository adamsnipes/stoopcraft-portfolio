import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { KNOWN_NICHES } from '@/lib/content-gen/generate';
import { generateClientSite } from '@/lib/content-gen/pipeline';
import { createServerClient } from '@/lib/supabase/server';

async function isAuthorized(req: NextRequest): Promise<boolean> {
  if (req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET) {
    return true;
  }
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && user.email === process.env.ADMIN_EMAIL;
}

// Discriminated union: a known niche needs no extra fields; `other` requires
// the user-typed industry_label (used for prompt anchoring + observability).
const inputSchema = z.discriminatedUnion('niche', [
  z.object({
    google_place_id: z.string().min(1),
    niche: z.enum(KNOWN_NICHES),
  }),
  z.object({
    google_place_id: z.string().min(1),
    niche: z.literal('other'),
    industry_label: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[a-zA-Z0-9 &/'-]+$/, 'industry_label must be plain text'),
  }),
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAuthorized(req))) {
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
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { google_place_id, niche } = parsed.data;
  const industry_label = niche === 'other' ? parsed.data.industry_label : null;

  const result = await generateClientSite({
    google_place_id,
    niche,
    industry_label,
    source: 'admin',
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.client_id ? { client_id: result.client_id } : {}) },
      { status: result.status },
    );
  }

  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const fullUrl = `https://${result.slug}.${platformDomain}?t=${result.claim_token}`;
  const shortUrl = `https://${platformDomain}/s/${result.short_code}`;
  return NextResponse.json({
    success: true,
    client_id: result.client_id,
    slug: result.slug,
    url: fullUrl,
    short_url: shortUrl,
    business_name: result.business_name,
    phone_number: result.phone_number,
    google_place_id: result.google_place_id,
    compositions: result.compositions,
  });
}
