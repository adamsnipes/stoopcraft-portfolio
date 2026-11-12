import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getEmailProvider } from '@/lib/email';

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const email = getEmailProvider();
  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const now = Date.now();

  // Find clients that cancelled and are in the 60-day retention window
  const { data: cancelledClients } = await admin
    .from('clients')
    .select('id, cancelled_at, hard_delete_at')
    .not('cancelled_at', 'is', null)
    .not('hard_delete_at', 'is', null)
    .gt('hard_delete_at', new Date().toISOString()); // not yet hard-deleted

  let sent30 = 0;
  let sent55 = 0;

  for (const client of cancelledClients ?? []) {
    if (!client.cancelled_at || !client.hard_delete_at) continue;

    const cancelledAt = new Date(client.cancelled_at).getTime();
    const hardDeleteAt = new Date(client.hard_delete_at).getTime();
    const daysSinceCancellation = (now - cancelledAt) / (24 * 60 * 60 * 1000);

    // Check if we already sent the reminder for this window
    const reminderType30 = 'reactivation_reminder_30';
    const reminderType55 = 'reactivation_reminder_55';

    const { count: alreadySent30 } = await admin
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .eq('type', reminderType30);

    const { count: alreadySent55 } = await admin
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .eq('type', reminderType55);

    const variables = {
      hard_delete_at: new Date(hardDeleteAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      reactivation_url: `https://${platformDomain}/portal`,
    };

    // 30-day reminder: send once on/after day 28 post-cancellation.
    // No upper bound — if cron misses days, the customer still gets reminded.
    // The hard_delete_at filter on the query ensures we don't email past retention.
    if (daysSinceCancellation >= 28 && !alreadySent30) {
      try {
        await email.send({ clientId: client.id, template: 'reactivation_reminder_30', variables });
        await admin.from('events').insert({ client_id: client.id, type: reminderType30, metadata: {} });
        sent30++;
      } catch {
        console.error('reactivation reminder 30 failed', { client_id: client.id });
      }
    }

    // 55-day reminder: send once on/after day 53 post-cancellation.
    if (daysSinceCancellation >= 53 && !alreadySent55) {
      try {
        await email.send({ clientId: client.id, template: 'reactivation_reminder_55', variables });
        await admin.from('events').insert({ client_id: client.id, type: reminderType55, metadata: {} });
        sent55++;
      } catch {
        console.error('reactivation reminder 55 failed', { client_id: client.id });
      }
    }
  }

  return NextResponse.json({ success: true, sent_30: sent30, sent_55: sent55 });
}
