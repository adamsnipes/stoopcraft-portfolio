import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { runScrape } from '@/lib/lead-scraping/scrape';
import { canonicalizeCity, resolveNiche } from '@/lib/lead-scraping/niches';

export const maxDuration = 300;

const inputSchema = z.object({
  niche: z.string().trim().min(2).max(80),
  location: z.string().trim().min(2).max(200),
  targetCount: z.number().int().min(1).max(100).default(50),
  noWebsiteOnly: z.boolean().default(true),
  mobileOnly: z.boolean().default(true),
  forceRecheckSeen: z.boolean().default(false),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userClient = await createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: 'google_places_not_configured' }, { status: 500 });
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
      { status: 400 },
    );
  }

  const sb = createServiceRoleClient();
  const niche = resolveNiche(parsed.data.niche);
  const canonicalCity = canonicalizeCity(parsed.data.location);

  const { data: runRow, error: runErr } = await sb
    .from('scrape_runs')
    .insert({
      niche: niche.key,
      niche_preset: niche.isPreset ? niche.key : null,
      location_input: parsed.data.location,
      canonical_city: canonicalCity,
      target_count: parsed.data.targetCount,
      no_website_only: parsed.data.noWebsiteOnly,
      mobile_only: parsed.data.mobileOnly,
      force_recheck_seen: parsed.data.forceRecheckSeen,
      status: 'running',
    })
    .select('id')
    .single();

  if (runErr || !runRow) {
    return NextResponse.json({ error: 'run_create_failed' }, { status: 500 });
  }

  const runId = runRow.id;

  if (parsed.data.mobileOnly && (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN)) {
    await sb
      .from('scrape_runs')
      .update({ status: 'error', error_message: 'twilio_not_configured', finished_at: new Date().toISOString() })
      .eq('id', runId);
    return NextResponse.json({ error: 'twilio_not_configured' }, { status: 500 });
  }

  try {
    const stats = await runScrape({
      sb,
      runId,
      scrapeOpts: {
        niche: parsed.data.niche,
        location: parsed.data.location,
        targetCount: parsed.data.targetCount,
        noWebsiteOnly: parsed.data.noWebsiteOnly,
        mobileOnly: parsed.data.mobileOnly,
        forceRecheckSeen: parsed.data.forceRecheckSeen,
      },
      googleApiKey: process.env.GOOGLE_PLACES_API_KEY!,
      twilioSid: process.env.TWILIO_ACCOUNT_SID ?? null,
      twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? null,
    });

    const status =
      stats.leadsFound >= parsed.data.targetCount ? 'success' : 'partial';

    await sb
      .from('scrape_runs')
      .update({
        leads_found: stats.leadsFound,
        candidates_seen: stats.candidatesSeen,
        candidates_skipped_seen: stats.candidatesSkippedAsSeen,
        places_api_calls: stats.placesApiCalls,
        twilio_api_calls: stats.twilioApiCalls,
        status,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId);

    const { data: leads } = await sb
      .from('scraped_leads')
      .select(
        'place_id, business_name, address, phone, normalized_phone, rating, review_count, uses_social_as_website, website_uri, line_type',
      )
      .eq('scrape_run_id', runId)
      .order('scraped_at', { ascending: true });

    return NextResponse.json({
      runId,
      stats,
      status,
      leads: leads ?? [],
      niche: { key: niche.key, displayName: niche.displayName, isPreset: niche.isPreset },
      canonicalCity,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'scrape_failed';
    await sb
      .from('scrape_runs')
      .update({ status: 'error', error_message: message, finished_at: new Date().toISOString() })
      .eq('id', runId);
    return NextResponse.json({ error: message, runId }, { status: 500 });
  }
}
