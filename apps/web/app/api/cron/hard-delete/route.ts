import { NextRequest, NextResponse } from 'next/server';
import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { removeDomainFromVercel } from '@/lib/vercel/domains';
import { deleteStaticBundle } from '@/lib/r2/static-site';
import { getStripe } from '@/lib/stripe';
import { LIVE_SUBSCRIPTION_STATUSES } from '@/lib/cancellation';
import { sendAdminAlert } from '@/lib/email';
import { escapeHtml } from '@/lib/email/templates';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

/**
 * Why a client past its hard_delete_at must not be deleted, or null if it can
 * be. hard_delete_at can outlive the cancellation it came from: a client
 * reactivated by hand in Stripe keeps it until someone links the subscription on
 * the admin Billing tab. Deleting can't be undone, so a failed check also blocks:
 * better a day late than removing a paying customer.
 */
async function deletionBlocker(stripeCustomerId: string | null): Promise<string | null> {
  if (!stripeCustomerId) return null;
  try {
    const { data } = await getStripe().subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 100,
    });
    const live = data.filter((sub) => LIVE_SUBSCRIPTION_STATUSES.has(sub.status));
    return live.length > 0 ? `Live subscription in Stripe: ${live.map((sub) => sub.id).join(', ')}` : null;
  } catch (err) {
    // Stripe has no such customer, so nobody can be paying on it.
    if ((err as { code?: string }).code === 'resource_missing') return null;
    return `Stripe check failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}

type SkippedClient = { id: string; business_name: string; reason: string };

function skippedAlertHtml(skipped: SkippedClient[]): string {
  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'stoopcraft.com';
  const items = skipped.map(
    ({ id, business_name, reason }) =>
      `<li><a href="https://${platformDomain}/admin/clients/${id}/billing">${escapeHtml(business_name)}</a>: ${escapeHtml(reason)}</li>`,
  );
  return (
    `<p>These clients are past their deletion date but were not deleted. ` +
    `If they're paying, open Billing and click Reactivate site. ` +
    `This runs again every night until then.</p><ul>${items.join('')}</ul>`
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const now = new Date().toISOString();

  // Find all clients past their hard_delete_at date
  const { data: clients, error } = await admin
    .from('clients')
    .select('id, business_name, slug, custom_domain, domain_owner, stripe_customer_id')
    .lt('hard_delete_at', now)
    .not('hard_delete_at', 'is', null);

  if (error) {
    console.error('hard-delete cron: fetch failed', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let deleted = 0;
  let failed = 0;
  const skipped: SkippedClient[] = [];

  for (const client of clients ?? []) {
    const blocker = await deletionBlocker(client.stripe_customer_id);
    if (blocker) {
      skipped.push({ id: client.id, business_name: client.business_name, reason: blocker });
      await admin.from('events').insert({
        client_id: client.id,
        type: 'hard_delete_skipped',
        metadata: { reason: blocker },
      });
      console.warn('hard-delete cron: skipped', { client_id: client.id, reason: blocker });
      continue;
    }

    try {
      // Log final audit event BEFORE any deletion
      await admin.from('events').insert({
        client_id: client.id,
        type: 'hard_delete_cron',
        metadata: {
          business_name: client.business_name,
          slug: client.slug,
          custom_domain: client.custom_domain,
        },
      });

      // Remove R2 objects for this client
      const prefix = `clients/${client.id}/`;
      let continuationToken: string | undefined;

      do {
        const listed = await r2.send(
          new ListObjectsV2Command({
            Bucket: process.env.R2_BUCKET_NAME!,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          })
        );

        const objects = (listed.Contents ?? []).map((o) => ({ Key: o.Key! }));
        if (objects.length > 0) {
          await r2.send(
            new DeleteObjectsCommand({
              Bucket: process.env.R2_BUCKET_NAME!,
              Delete: { Objects: objects },
            })
          );
        }

        continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
      } while (continuationToken);

      // Remove the static site bundle, which lives under a separate slug-based
      // prefix (`static-sites/<slug>/`). deleteStaticBundle paginates + re-checks
      // each key against the prefix; skip if the row somehow has no slug.
      if (client.slug) {
        await deleteStaticBundle(client.slug);
      }

      // Remove custom domain from Vercel if platform-owned
      if (client.custom_domain && client.domain_owner === 'platform') {
        await removeDomainFromVercel(client.custom_domain);
      }

      // Delete DB row — cascades to content, photos, requests
      await admin.from('clients').delete().eq('id', client.id);

      console.log('hard-delete cron: deleted', {
        client_id: client.id,
        business_name: client.business_name,
      });
      deleted++;
    } catch (err) {
      console.error('hard-delete cron: failed for client', {
        client_id: client.id,
        error: err instanceof Error ? err.message : String(err),
      });
      failed++;
    }
  }

  if (skipped.length > 0) {
    try {
      await sendAdminAlert({
        subject: `Hard delete skipped for ${skipped.length} client${skipped.length === 1 ? '' : 's'}`,
        html: skippedAlertHtml(skipped),
      });
    } catch (err) {
      console.error('hard-delete cron: skip alert failed', err);
    }
  }

  return NextResponse.json({ success: true, deleted, failed, skipped: skipped.length });
}
