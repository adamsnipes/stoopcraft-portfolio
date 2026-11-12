import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getEmailProvider } from '@/lib/email';

// Vercel cron security: requests come with Authorization: Bearer {CRON_SECRET}
function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const email = getEmailProvider();

  // Fetch all active paying clients
  const { data: clients, error } = await admin
    .from('clients')
    .select('id, plan, cancelled_at')
    .eq('status', 'claimed')
    .is('cancelled_at', null)
    .not('plan', 'is', null);

  if (error) {
    console.error('monthly-reports: fetch clients failed', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';

  let sent = 0;
  let failed = 0;

  for (const client of clients ?? []) {
    try {
      // Count events for the past 30 days
      const [pageViewsRes, contactClicksRes, bookingClicksRes] = await Promise.all([
        admin.from('events').select('id', { count: 'exact', head: true })
          .eq('client_id', client.id).eq('type', 'page_view').gte('created_at', thirtyDaysAgo),
        admin.from('events').select('id', { count: 'exact', head: true })
          .eq('client_id', client.id).eq('type', 'contact_click').gte('created_at', thirtyDaysAgo),
        admin.from('events').select('id', { count: 'exact', head: true })
          .eq('client_id', client.id).eq('type', 'booking_click').gte('created_at', thirtyDaysAgo),
      ]);

      await email.send({
        clientId: client.id,
        template: 'monthly_report',
        variables: {
          month,
          page_views: String(pageViewsRes.count ?? 0),
          contact_clicks: String(contactClicksRes.count ?? 0),
          booking_clicks: String(bookingClicksRes.count ?? 0),
          portal_url: `https://${platformDomain}/portal`,
        },
      });

      await admin.from('events').insert({
        client_id: client.id,
        type: 'monthly_report_sent',
        metadata: {
          month,
          page_views: pageViewsRes.count ?? 0,
          contact_clicks: contactClicksRes.count ?? 0,
          booking_clicks: bookingClicksRes.count ?? 0,
        },
      });

      sent++;
    } catch (err) {
      // Per-client failure is non-fatal — log and continue
      console.error('monthly-reports: failed for client', {
        client_id: client.id,
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }
  }

  return NextResponse.json({ success: true, sent, failed });
}
