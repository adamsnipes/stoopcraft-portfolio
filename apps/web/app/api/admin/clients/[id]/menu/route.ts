import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { revalidateClientSite } from '@/lib/revalidation';
import { isAllowedPhotoUrl } from '@/lib/photos/url-whitelist';

type RouteContext = { params: Promise<{ id: string }> };

async function assertAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === process.env.ADMIN_EMAIL;
}

// Item / category shape — id is required (caller mints UUIDs in the editor).
// Strings are length-bounded; the editor strips empty-name items before sending.
const itemSchema = z.object({
  id: z.string().min(1),
  external_id: z.string().optional(),
  name: z.string().min(1).max(80),
  description: z.string().max(280).default(''),
  price: z.string().max(40).default(''),
  dietary: z.array(z.enum(['gf', 'vg', 'v', 'df', 'spicy', 'nf'])).optional(),
  photo_id: z.string().uuid().optional(),
  // External hotlink. Whitelist enforced at the value layer (must be https +
  // an allow-listed host); see lib/photos/url-whitelist.
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

export async function PUT(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

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

  const supabase = createServiceRoleClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, slug, custom_domain, business_vertical')
    .eq('id', id)
    .single();
  if (!client) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Menu only makes sense for restaurant clients. Reject early so we don't
  // pollute salon content rows with menu data that no template will read.
  if (client.business_vertical !== 'restaurant') {
    return NextResponse.json(
      { error: 'wrong_vertical', message: 'Menu editing is only available for restaurant clients.' },
      { status: 422 },
    );
  }

  const { error } = await supabase
    .from('content')
    .update({ menu: parsed.data.menu })
    .eq('client_id', id)
    .eq('is_published', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateClientSite(client.slug, client.custom_domain);

  return NextResponse.json({ success: true });
}
