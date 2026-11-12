import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedClient } from '@/lib/tenant';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { revalidateClientSite } from '@/lib/revalidation';
import { isAllowedPhotoUrl } from '@/lib/photos/url-whitelist';

// Same shape as the admin route. Customers PUT directly to their own menu —
// the client_id is derived from the session, NEVER from the request body.
const itemSchema = z.object({
  id: z.string().min(1),
  external_id: z.string().optional(),
  name: z.string().min(1).max(80),
  description: z.string().max(280).default(''),
  price: z.string().max(40).default(''),
  dietary: z.array(z.enum(['gf', 'vg', 'v', 'df', 'spicy', 'nf'])).optional(),
  photo_id: z.string().uuid().optional(),
  photo_url: z
    .string()
    .max(500)
    .refine(isAllowedPhotoUrl, { message: 'photo_url host not allowed' })
    .optional(),
  is_synced: z.boolean().optional(),
});

const categorySchema = z.object({
  id: z.string().min(1),
  external_id: z.string().optional(),
  title: z.string().min(1).max(60),
  description: z.string().max(160).optional(),
  items: z.array(itemSchema).min(1).max(40),
});

const menuPayloadSchema = z.object({
  menu: z.object({
    categories: z.array(categorySchema).min(1).max(20),
    show_images: z.boolean().optional(),
  }),
});

export async function PUT(req: NextRequest): Promise<NextResponse> {
  // client_id derived from session — same defense pattern as /api/portal/request.
  const ctx = await getAuthenticatedClient();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Menu maintenance is restaurant-only. Salon customers have no menu to edit.
  if (ctx.client.business_vertical !== 'restaurant') {
    return NextResponse.json(
      { error: 'wrong_vertical', message: 'Menu editing is only available for restaurant accounts.' },
      { status: 422 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = menuPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const admin = createServiceRoleClient();

  const { error } = await admin
    .from('content')
    .update({ menu: parsed.data.menu })
    .eq('client_id', ctx.client.id)
    .eq('is_published', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateClientSite(ctx.client.slug, ctx.client.custom_domain);

  return NextResponse.json({ success: true });
}
