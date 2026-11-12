'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SubscriptionLinkBlocker } from '@/lib/cancellation';
import type { SubscriptionCheck } from '@/app/api/admin/clients/[id]/subscription/route';
import { Badge, Panel, btn, field, formatDate } from '../../ui';

// Compares this client with Stripe and reactivates it from a live subscription,
// for clients reactivated by hand in Stripe, which no webhook can link back here.
// The check runs on load so a paying client's offline site is visible on sight.

// not_live has no text: the status badge beside it already says so.
const BLOCKER_TEXT: Record<SubscriptionLinkBlocker, string | null> = {
  not_live: null,
  scheduled_to_end: 'Still scheduled to end. Remove the cancellation in Stripe first.',
  other_platform: 'Belongs to another platform, not StoopCraft.',
  other_client: 'Linked to a different client.',
};

const ERROR_TEXT: Record<string, string> = {
  invalid_stripe_id: 'That doesn’t look like a cus_… or sub_… id.',
  not_found_in_stripe: 'Stripe has nothing with that id.',
  other_platform: BLOCKER_TEXT.other_platform as string,
  other_client: 'A different client already has this subscription or customer.',
  not_live: 'This subscription is no longer active in Stripe.',
  scheduled_to_end: BLOCKER_TEXT.scheduled_to_end as string,
  plan_unknown: 'Can’t tell which plan this is. Set the plan on the subscription’s metadata in Stripe.',
  no_owner: 'Linked, but the Stripe customer has no email, so no owner could be created. The site stays offline until it has one.',
};

function errorMessage(data: { error?: string; detail?: string }, status: number): string {
  return (data.error && ERROR_TEXT[data.error]) || data.detail || data.error || `Failed (${status})`;
}

async function fetchCheck(
  clientId: string,
  lookup: string | null,
): Promise<{ check: SubscriptionCheck | null; error: string | null }> {
  const query = lookup ? `?stripe=${encodeURIComponent(lookup)}` : '';
  try {
    const res = await fetch(`/api/admin/clients/${clientId}/subscription${query}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { check: null, error: errorMessage(json, res.status) };
    return { check: json as SubscriptionCheck, error: null };
  } catch (err) {
    return { check: null, error: err instanceof Error ? err.message : 'network error' };
  }
}

export function SubscriptionRecoveryPanel({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [check, setCheck] = useState<SubscriptionCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState('');
  // 'lookup', or the id of the subscription being linked.
  const [busy, setBusy] = useState<string | null>(null);
  const [reactivated, setReactivated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchCheck(clientId, null).then((result) => {
      if (cancelled) return;
      setCheck(result.check);
      setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy('lookup');
    setReactivated(false);
    const result = await fetchCheck(clientId, lookup.trim() || null);
    // Keep the last good result on screen if a pasted id is wrong.
    if (result.check) setCheck(result.check);
    setError(result.error);
    setBusy(null);
  }

  async function handleReactivate(subscriptionId: string) {
    setBusy(subscriptionId);
    setError(null);
    setReactivated(false);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: subscriptionId }),
      });
      if (!res.ok) {
        setError(errorMessage(await res.json().catch(() => ({})), res.status));
        return;
      }
      const result = await fetchCheck(clientId, lookup.trim() || null);
      if (result.check) setCheck(result.check);
      setError(result.error);
      setReactivated(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error');
    } finally {
      setBusy(null);
    }
  }

  const client = check?.client;
  const subscriptions = check?.subscriptions ?? [];
  const blocksSite = !!client && (!!client.cancelledAt || !client.hasOwner || client.status !== 'claimed');
  const linkedIsLive = subscriptions.some((s) => s.current && !s.blocker);
  // A healthy client gets no buttons: its other subscriptions may be add-ons, and
  // one stray click would move the client off the subscription that's working.
  const canAct = blocksSite || !linkedIsLive;
  const inSync = !!client && !blocksSite && linkedIsLive;

  return (
    <Panel
      title="Reactivate from Stripe"
      description="Compares this client with Stripe. If they were reactivated in Stripe, link the live subscription here to bring the site back and clear the deletion date."
    >
      {!check && !error && <p className="text-sm text-ink-700">Checking Stripe…</p>}

      {client?.cancelledAt && (
        <div className="mb-3 rounded-xl border border-amber-accent/30 bg-amber-accent/[0.06] p-4 text-sm">
          <p className="font-medium">Marked cancelled on {formatDate(client.cancelledAt)}.</p>
          {client.expiresAt && (
            <p className="mt-1 text-ink-700">Paid access ends or ended {formatDate(client.expiresAt)}.</p>
          )}
          {client.hardDeleteAt && (
            <p className="mt-1 text-ink-700">
              Everything is permanently deleted on {formatDate(client.hardDeleteAt)} unless reactivated.
            </p>
          )}
        </div>
      )}

      {client && !client.hasOwner && client.status === 'claimed' && (
        <p className="mb-3 text-sm text-ink-700">
          No owner on this client, so its site can&rsquo;t serve. Reactivating creates one from the
          Stripe customer&rsquo;s email.
        </p>
      )}

      {check?.siteFilesPresent === false && (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          The site files are missing from storage. Upload the bundle again on the Setup tab, or the
          site will still 404 after reactivating.
        </p>
      )}

      {reactivated && (
        <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Reactivated. The deletion date is cleared and the site can serve again. A custom domain still
          needs its DNS pointed at us.
        </p>
      )}

      {inSync && !reactivated && <p className="mb-3 text-sm text-ink-700">In sync with Stripe.</p>}

      {check && subscriptions.length === 0 && (
        <p className="mb-3 text-sm text-ink-700">
          {client?.customerId
            ? `No subscriptions on ${client.customerId}.`
            : 'No Stripe customer on this client yet.'}
        </p>
      )}

      {subscriptions.length > 0 && (
        <ul className="mb-4 divide-y divide-ink-900/[0.06] rounded-xl border border-ink-900/10">
          {subscriptions.map((sub) => {
            const blockerText = sub.blocker ? BLOCKER_TEXT[sub.blocker] : null;
            return (
              <li key={sub.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-all font-mono text-xs">{sub.id}</span>
                    <Badge tone={sub.blocker === 'not_live' ? 'neutral' : 'green'}>{sub.status}</Badge>
                    {sub.current && <Badge>Linked</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-ink-700">
                    {sub.price} · started {formatDate(sub.startedAt)}
                    {sub.cancelAt && ` · ends ${formatDate(sub.cancelAt)}`}
                  </p>
                  {blockerText && <p className="mt-1 text-xs text-red-700">{blockerText}</p>}
                </div>
                {canAct && !sub.blocker && (
                  <button
                    type="button"
                    onClick={() => handleReactivate(sub.id)}
                    disabled={busy !== null}
                    className={btn.primary}
                  >
                    {busy === sub.id ? 'Reactivating…' : 'Reactivate site'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

      <form onSubmit={handleLookup}>
        <label htmlFor="stripe-lookup" className="text-xs text-ink-700">
          Not listed? Paste their Stripe customer or subscription ID.
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="stripe-lookup"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="cus_… or sub_…"
            className={`${field} min-w-0 flex-1 font-mono`}
          />
          <button type="submit" disabled={busy !== null} className={btn.secondary}>
            {busy === 'lookup' ? 'Checking…' : 'Look up'}
          </button>
        </div>
      </form>
    </Panel>
  );
}
