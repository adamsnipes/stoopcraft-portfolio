'use client';

import { useCallback, useEffect, useState } from 'react';

type Property = {
  siteUrl: string;
  permissionLevel: string;
  readOnly: boolean;
  clientId: string | null;
  clientName: string | null;
  linked: boolean;
};

type Recipient = { email: string; source: 'owner' | 'notification' } | null;

type ReportResponse = {
  report: {
    range: { label: string };
    totals: { clicks: number; impressions: number; ctr: number; position: number };
    change: { clicksPct: number | null; impressionsPct: number | null; position: number | null };
    topQueries: { query: string }[];
    newQueries: { query: string }[];
    strikingDistance: { query: string }[];
    funnel: unknown | null;
  };
  subject: string;
  html: string;
  recipient: Recipient;
};

const RANGES = [
  { days: 28, label: '28 days' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '12 months' },
];

const card = 'bg-white rounded-2xl border border-ink-900/10 p-6 mb-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]';
const btn = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50';

export function SeoReportPanel({
  clientId,
  clientDomain,
  initialProperty,
  lastSentAt,
}: {
  clientId: string;
  clientDomain: string;
  initialProperty: string | null;
  lastSentAt: string | null;
}) {
  const [property, setProperty] = useState(initialProperty ?? '');
  const [saved, setSaved] = useState(initialProperty ?? '');
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [serviceAccount, setServiceAccount] = useState<string | null>(null);
  const [propsError, setPropsError] = useState<string | null>(null);

  const [days, setDays] = useState(90);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<'test' | 'client' | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  // Property list drives the dropdown. Fetched once — it's a single Google call
  // covering every client, so there's nothing per-client to refresh.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/gsc/properties');
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setPropsError(json.detail ?? json.error ?? 'Could not list properties');
          return;
        }
        setProperties(json.properties ?? []);
        setServiceAccount(json.serviceAccount ?? null);
      } catch (err) {
        if (!cancelled) setPropsError(err instanceof Error ? err.message : 'network error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProperty(value: string) {
    setError(null);
    const res = await fetch(`/api/admin/clients/${clientId}/gsc-property`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gsc_property: value }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.detail ?? json.error ?? 'Save failed');
      return;
    }
    setSaved(json.gsc_property ?? '');
    setData(null);
  }

  const loadReport = useCallback(
    async (windowDays: number) => {
      setLoading(true);
      setError(null);
      setSent(null);
      try {
        const res = await fetch(`/api/admin/clients/${clientId}/seo-report?days=${windowDays}`);
        const json = await res.json();
        if (!res.ok) {
          setError(
            json.error === 'not_connected'
              ? 'Link a Search Console property first.'
              : (json.detail ?? json.error ?? 'Could not build the report'),
          );
          setData(null);
          return;
        }
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'network error');
      } finally {
        setLoading(false);
      }
    },
    [clientId],
  );

  async function send(mode: 'test' | 'client') {
    if (mode === 'client' && !confirm(`Send this report to ${data?.recipient?.email}?`)) return;
    setSending(mode);
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/seo-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, days }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.detail ?? json.error ?? 'Send failed');
        return;
      }
      setSent(`Sent to ${json.to}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error');
    } finally {
      setSending(null);
    }
  }

  // Surface the property whose host matches this client's domain, so linking is
  // a confirm rather than a hunt through every property on the account.
  const suggested = properties?.find((p) => p.clientId === clientId && !p.linked);

  return (
    <div>
      <div className={card}>
        <h2 className="font-display text-lg font-medium mb-1">Search Console property</h2>
        <p className="text-xs text-ink-700 mb-4">
          Which property in the agency Google account holds this client&apos;s data.{' '}
          <span className="font-mono">sc-domain:{clientDomain}</span> and{' '}
          <span className="font-mono">https://{clientDomain}/</span> are different properties — pick the one
          that actually has data.
        </p>

        {propsError && (
          <p className="text-sm text-red-700 mb-3">
            {propsError}
            {serviceAccount && (
              <>
                {' '}
                Service account: <span className="font-mono text-xs">{serviceAccount}</span>
              </>
            )}
          </p>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={property}
            onChange={(e) => setProperty(e.target.value)}
            className="border border-ink-900/10 rounded-lg px-3 py-2 text-sm bg-white min-w-[280px]"
          >
            <option value="">— not linked —</option>
            {properties?.map((p) => (
              <option key={p.siteUrl} value={p.siteUrl}>
                {p.siteUrl}
                {p.clientName && p.clientId !== clientId ? ` (already: ${p.clientName})` : ''}
              </option>
            ))}
            {/* Keep a stored value selectable even if Google no longer lists it. */}
            {saved && !properties?.some((p) => p.siteUrl === saved) && <option value={saved}>{saved}</option>}
          </select>

          <button
            type="button"
            onClick={() => saveProperty(property)}
            disabled={property === saved}
            className={`${btn} bg-ink-900 text-cream-50 hover:bg-ink-800`}
          >
            Save
          </button>

          {suggested && property !== suggested.siteUrl && (
            <button
              type="button"
              onClick={() => setProperty(suggested.siteUrl)}
              className="text-sm text-ink-700 underline hover:text-ink-900"
            >
              Use {suggested.siteUrl}
            </button>
          )}
        </div>

        {saved && (
          <p className="text-xs text-ink-700/70 mt-3">
            Linked to <span className="font-mono">{saved}</span>
            {lastSentAt && <> · last report sent {new Date(lastSentAt).toLocaleDateString()}</>}
          </p>
        )}
      </div>

      <div className={card}>
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <h2 className="font-display text-lg font-medium">Report</h2>
          <div className="flex items-center gap-2">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => {
                  setDays(r.days);
                  setData(null);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  days === r.days ? 'bg-ink-900 text-cream-50' : 'text-ink-700 hover:bg-ink-900/5'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => loadReport(days)}
            disabled={loading || !saved}
            className={`${btn} bg-ink-900 text-cream-50 hover:bg-ink-800`}
          >
            {loading ? 'Pulling from Google…' : data ? 'Refresh' : 'Build report'}
          </button>

          {data && (
            <>
              <button
                type="button"
                onClick={() => send('test')}
                disabled={sending !== null}
                className={`${btn} border border-ink-900/15 text-ink-900 hover:bg-ink-900/5`}
              >
                {sending === 'test' ? 'Sending…' : 'Send test to me'}
              </button>
              <button
                type="button"
                onClick={() => send('client')}
                disabled={sending !== null || !data.recipient}
                className={`${btn} bg-emerald-700 text-white hover:bg-emerald-800`}
              >
                {sending === 'client'
                  ? 'Sending…'
                  : data.recipient
                    ? `Send to ${data.recipient.email}`
                    : 'No recipient on file'}
              </button>
            </>
          )}
        </div>

        {data?.recipient?.source === 'notification' && (
          <p className="text-xs text-amber-700 mt-3">
            No portal account — this would go to the lead-notification address.
          </p>
        )}
        {error && <p className="text-sm text-red-700 mt-3">{error}</p>}
        {sent && <p className="text-sm text-emerald-700 mt-3">{sent}</p>}

        {data && (
          <div className="mt-5 pt-5 border-t border-ink-900/10">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <Stat label="Clicks" value={data.report.totals.clicks.toLocaleString()} />
              <Stat label="Impressions" value={data.report.totals.impressions.toLocaleString()} />
              <Stat label="Avg position" value={data.report.totals.position.toFixed(1)} />
              <Stat label="CTR" value={`${(data.report.totals.ctr * 100).toFixed(1)}%`} />
            </div>
            <p className="text-xs text-ink-700/70">
              {data.report.range.label} · {data.report.topQueries.length} queries ·{' '}
              {data.report.newQueries.length} new · {data.report.strikingDistance.length} near page one ·{' '}
              {data.report.funnel ? 'on-site funnel included' : 'no on-site events'}
            </p>
          </div>
        )}
      </div>

      {data && (
        <div className={card}>
          <h2 className="font-display text-lg font-medium mb-1">Email preview</h2>
          <p className="text-xs text-ink-700 mb-4">
            Subject: <span className="font-medium text-ink-900">{data.subject}</span>
          </p>
          {/* srcDoc + sandbox: renders the real email HTML without letting it
              touch the admin page's styles or scripts. */}
          <iframe
            title="SEO report preview"
            srcDoc={data.html}
            sandbox=""
            className="w-full h-[900px] border border-ink-900/10 rounded-lg bg-white"
          />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-ink-700/60">{label}</div>
      <div className="text-2xl font-medium text-ink-900">{value}</div>
    </div>
  );
}
