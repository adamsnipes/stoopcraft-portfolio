import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getEmailProvider, escapeHtml } from '@/lib/email';

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(['open', 'in_progress', 'done', 'declined']),
  resolution_notes: z.string().max(1000).optional(),
});

async function handlePatch(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    const ct = req.headers.get('content-type') ?? '';
    if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const form = await req.formData();
      body = Object.fromEntries(form.entries());
    } else {
      body = await req.json();
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const update = {
    status: parsed.data.status,
    resolution_notes: parsed.data.resolution_notes ?? null,
    resolved_at: (parsed.data.status === 'done' || parsed.data.status === 'declined')
      ? new Date().toISOString()
      : null,
  };

  const { error } = await admin.from('requests').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send status update email — non-fatal
  try {
    const { data: req } = await admin
      .from('requests')
      .select('body, client_id, clients(slug, custom_domain)')
      .eq('id', id)
      .single();

    if (req) {
      const client = req.clients as { slug: string; custom_domain: string | null } | null;
      const platformDomain = process.env.PLATFORM_DOMAIN ?? 'stoopcraft.com';
      const siteUrl = client?.custom_domain
        ? `https://${client.custom_domain}`
        : `https://${client?.slug ?? ''}.${platformDomain}`;

      const resolutionNoteHtml = parsed.data.resolution_notes
        ? `<div style="margin:0 0 16px 0;padding:12px 16px;background-color:#f0f9ff;border-left:3px solid #0ea5e9;border-radius:4px;color:#0c4a6e;"><strong>Note from us:</strong> ${escapeHtml(parsed.data.resolution_notes)}</div>`
        : '';

      if (parsed.data.status === 'done') {
        await getEmailProvider().send({
          clientId: req.client_id,
          template: 'request_resolved',
          variables: {
            site_url: siteUrl,
            resolution_note_html: resolutionNoteHtml,
          },
        });
      } else {
        const statusLabels: Record<string, string> = {
          open: 'Reopened',
          in_progress: 'In progress — we\'re working on it',
          declined: 'Declined',
        };
        await getEmailProvider().send({
          clientId: req.client_id,
          template: 'request_status_updated',
          variables: {
            body: req.body,
            status_label: statusLabels[parsed.data.status] ?? parsed.data.status,
            resolution_note_html: resolutionNoteHtml,
            portal_url: `https://${platformDomain}/portal`,
          },
        });
      }
    }
  } catch {
    console.error('request status email failed', { request_id: id });
  }

  return NextResponse.json({ success: true });
}

export const PATCH = handlePatch;
export const POST = handlePatch;
