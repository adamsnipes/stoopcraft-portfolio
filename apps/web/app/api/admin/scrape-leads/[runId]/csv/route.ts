import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ runId: string }> },
): Promise<NextResponse> {
  const userClient = await createServerClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { runId } = await ctx.params;
  const sb = createServiceRoleClient();

  const { data: run } = await sb
    .from('scrape_runs')
    .select('niche, canonical_city, started_at')
    .eq('id', runId)
    .single();

  if (!run) return NextResponse.json({ error: 'run_not_found' }, { status: 404 });

  const { data: leads } = await sb
    .from('scraped_leads')
    .select(
      'business_name, address, phone, normalized_phone, rating, review_count, uses_social_as_website, website_uri, line_type, place_id',
    )
    .eq('scrape_run_id', runId)
    .order('scraped_at', { ascending: true });

  // `phone_number` is the E.164 format Twilio's `To` parameter expects
  // (+15017332687). `phone_display` is the human-readable national format.
  // Put E.164 first so n8n / spreadsheet auto-mapping picks up the right
  // column for SMS sends.
  const headers = [
    'business_name',
    'phone_number',
    'phone_display',
    'address',
    'rating',
    'review_count',
    'website_uri',
    'uses_social_as_website',
    'line_type',
    'place_id',
  ];

  const lines = [headers.join(',')];
  for (const lead of leads ?? []) {
    lines.push(
      [
        csvEscape(lead.business_name),
        csvEscape(lead.normalized_phone),
        csvEscape(lead.phone),
        csvEscape(lead.address),
        csvEscape(lead.rating),
        csvEscape(lead.review_count),
        csvEscape(lead.website_uri),
        csvEscape(lead.uses_social_as_website ? 'Yes' : 'No'),
        csvEscape(lead.line_type),
        csvEscape(lead.place_id),
      ].join(','),
    );
  }

  const niceCity = run.canonical_city.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const niceNiche = run.niche.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const date = run.started_at.slice(0, 10);
  const filename = `leads-${niceNiche}-${niceCity}-${date}.csv`;

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
