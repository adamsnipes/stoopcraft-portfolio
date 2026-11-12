import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { uploadBlogImage } from '@/lib/r2/blog-image';

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

async function assertAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user?.email && user.email === process.env.ADMIN_EMAIL;
}

// Upload a blog image (cover or in-content) for a client → R2. Returns the
// public URL. Admin-gated; the key is namespaced under clients/<id>/blog/.
export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }
  const file = form.get('image');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'unsupported_type' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadBlogImage(id, buffer, file.type);
  if (!url) {
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 });
  }
  return NextResponse.json({ url });
}
