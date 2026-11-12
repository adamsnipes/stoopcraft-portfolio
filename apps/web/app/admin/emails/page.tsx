import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { EmailComposer } from './EmailComposer';
import { TEST_RECIPIENT } from './constants';
import { Badge, Card, EmptyState, PageHeader, SectionHeading } from '../ui';

export const metadata: Metadata = { title: 'Emails' };

// Server component reads live on each visit; keep it dynamic.
export const dynamic = 'force-dynamic';

export type ClientOption = { id: string; name: string; email: string };

export default async function EmailsPage() {
  const admin = createServiceRoleClient();

  // Client dropdown options. Best available address per client: the explicit
  // lead-notification email if set, else the owner's account email. Resolve all
  // owner emails in a single listUsers call rather than per-client lookups.
  const [{ data: clients }, usersResult] = await Promise.all([
    admin
      .from('clients')
      .select('id, business_name, notification_email, owner_user_id')
      .order('business_name'),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailByUser = new Map<string, string>();
  for (const u of usersResult.data?.users ?? []) {
    if (u.email) emailByUser.set(u.id, u.email);
  }

  const clientOptions: ClientOption[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.business_name,
    email:
      c.notification_email ??
      (c.owner_user_id ? emailByUser.get(c.owner_user_id) ?? '' : ''),
  }));

  const { data: history } = await admin
    .from('admin_emails')
    .select('id, to_email, subject, body, is_test, status, error, sent_by, created_at, clients(business_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div>
      <PageHeader
        title="Emails"
        description={
          <>
            Send a one-off email to a client from <strong>notifications@stoopcraft.com</strong>. Use
            “Send test” to preview it in {TEST_RECIPIENT} first.
          </>
        }
      />

      <EmailComposer clients={clientOptions} testRecipient={TEST_RECIPIENT} />

      <div className="mt-10">
        <SectionHeading>Previously sent</SectionHeading>
      </div>
      <div className="space-y-2">
        {(history ?? []).map((row) => {
          const client = row.clients as { business_name: string } | null;
          const failed = row.status === 'failed';
          return (
            <Card key={row.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium truncate">{row.subject}</span>
                    {row.is_test && <Badge tone="amber">Test</Badge>}
                    {failed && <Badge tone="red">Failed</Badge>}
                  </div>
                  <p className="text-xs text-ink-700/70">
                    To {row.to_email}
                    {client ? ` · ${client.business_name}` : ''} ·{' '}
                    {new Date(row.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="text-sm text-ink-700 mt-2 whitespace-pre-wrap line-clamp-3">{row.body}</p>
                  {failed && row.error && (
                    <p className="text-xs text-red-700 mt-2">Error: {row.error}</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        {(history ?? []).length === 0 && (
          <Card padded={false}>
            <EmptyState title="No emails sent yet." />
          </Card>
        )}
      </div>
    </div>
  );
}
