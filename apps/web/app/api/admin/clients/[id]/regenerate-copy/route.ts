import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { regenerateCopy } from '@/lib/content-gen/regenerate';
import { KNOWN_NICHES, type Niche } from '@/lib/content-gen/generate';
import { parseTheme, parseServices } from '@/lib/tenant';

type RouteContext = { params: Promise<{ id: string }> };

const inputSchema = z.object({
  tone_hint: z.string().trim().min(3).max(500),
});

export async function POST(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  // ── Auth: admin email only ──────────────────────────────────────────────
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
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
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.issues },
      { status: 400 }
    );
  }

  // ── Load current state ──────────────────────────────────────────────────
  const admin = createServiceRoleClient();

  const { data: client } = await admin
    .from('clients')
    .select('id, business_name, niche, city, state')
    .eq('id', id)
    .single();
  if (!client) return NextResponse.json({ error: 'client_not_found' }, { status: 404 });

  const { data: content } = await admin
    .from('content')
    .select('hero_headline, hero_headline_emphasis, hero_subheadline, hero_cta_text, about_title, about_body, services, theme')
    .eq('client_id', id)
    .eq('is_published', true)
    .single();
  if (!content) return NextResponse.json({ error: 'content_not_found' }, { status: 404 });

  // Niche must be a known niche or 'other'. Generated rows that predate the
  // 'other' niche always map to a known one; very old rows could have an
  // unrecognized string — fall back to 'other' so the call doesn't 500.
  const niche: Niche = (KNOWN_NICHES as readonly string[]).includes(client.niche)
    ? (client.niche as Niche)
    : 'other';

  const theme = parseTheme(content.theme);

  // ── Build the "current copy" payload from the row ───────────────────────
  type ServiceRow = { name: string; description: string; price?: string };
  const services: ServiceRow[] = parseServices(content.services).map((s) => {
    const out: ServiceRow = {
      name: s.name,
      description: s.description ?? '',
    };
    if (s.price) out.price = s.price;
    return out;
  });

  const currentCopy = {
    hero: {
      headline: content.hero_headline ?? client.business_name,
      ...(content.hero_headline_emphasis
        ? { headline_emphasis: content.hero_headline_emphasis }
        : {}),
      subheadline: content.hero_subheadline ?? '',
      cta_text: content.hero_cta_text ?? 'Get in Touch',
    },
    about: {
      title: content.about_title ?? 'About Us',
      body: content.about_body ?? '',
    },
    services,
  };

  // Rough length-floor check on about_body — the schema requires min 50 chars.
  // If the row has a tiny stub from an old generation, pad with the headline
  // so the LLM has something to work from.
  if (currentCopy.about.body.length < 50) {
    currentCopy.about.body =
      `${client.business_name} — ${currentCopy.hero.subheadline || currentCopy.hero.headline}. ` +
      `Located in ${client.city}, ${client.state}.`.slice(0, 800);
  }

  // ── LLM rewrite ─────────────────────────────────────────────────────────
  let suggested;
  try {
    suggested = await regenerateCopy({
      business_name: client.business_name,
      niche,
      city: client.city,
      state: client.state,
      // industry_label could be looked up from a prior 'generated' event for
      // 'other' niches; not yet wired since most rows are known niches.
      current: currentCopy,
      current_style: theme.style,
      tone_hint: parsed.data.tone_hint,
    });
  } catch (err) {
    console.error('regenerateCopy failed', {
      client_id: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'regeneration_failed' }, { status: 500 });
  }

  // Audit: capture every regeneration so we can study which prompts work.
  await admin.from('events').insert({
    client_id: id,
    type: 'admin_copy_regeneration',
    metadata: {
      admin: user.email,
      tone_hint: parsed.data.tone_hint,
      style: theme.style,
    },
  });

  // Return SUGGESTIONS only — the admin reviews and saves explicitly through
  // the normal content-update endpoint. No DB write here.
  return NextResponse.json({ success: true, copy: suggested });
}
