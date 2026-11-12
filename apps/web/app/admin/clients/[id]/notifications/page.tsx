import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getClient } from '../client-data';
import { ApplicationTestModePanel } from '../ApplicationTestModePanel';
import { SmsNotificationPanel } from '../SmsNotificationPanel';

type Params = Promise<{ id: string }>;

/**
 * Notifications tab — how leads reach the client, beyond the notification email
 * itself (which stays on Setup because it's set on nearly every new build).
 */
export default async function ClientNotificationsPage({ params }: { params: Params }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  return (
    <div>
      <p className="mb-4 text-sm text-ink-700/70">
        The address leads are emailed to lives on the{' '}
        <Link href={`/admin/clients/${id}`} className="text-amber-accent hover:underline">
          Setup
        </Link>{' '}
        tab. These are the extras layered on top of it.
      </p>

      {/* Route application PDFs to the ops inbox while verifying the flow. */}
      <ApplicationTestModePanel
        clientId={id}
        currentEnabled={client.application_test_mode ?? false}
      />

      {/* Paid upsell, gated per client on sms_notifications_enabled. */}
      <SmsNotificationPanel
        clientId={id}
        currentEnabled={client.sms_notifications_enabled ?? false}
        currentPhone={client.notification_phone ?? null}
      />
    </div>
  );
}
