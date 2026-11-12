'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Preset = { key: string; label: string };

type Lead = {
  place_id: string;
  business_name: string;
  address: string | null;
  phone: string;
  normalized_phone: string;
  rating: number | null;
  review_count: number | null;
  uses_social_as_website: boolean;
  website_uri: string | null;
  line_type: string | null;
};

type Stats = {
  candidatesSeen: number;
  candidatesSkippedAsSeen: number;
  placesApiCalls: number;
  twilioApiCalls: number;
  leadsFound: number;
};

type ScrapeResult = {
  runId: string;
  status: 'success' | 'partial' | 'error';
  stats: Stats;
  leads: Lead[];
  canonicalCity: string;
};

export function ScrapeLeadsForm({ presets }: { presets: Preset[] }) {
  const router = useRouter();
  const [niche, setNiche] = useState<string>(presets[0]?.key ?? '');
  const [customNiche, setCustomNiche] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [targetCount, setTargetCount] = useState<number>(50);
  const [noWebsiteOnly, setNoWebsiteOnly] = useState<boolean>(true);
  const [mobileOnly, setMobileOnly] = useState<boolean>(true);
  const [forceRecheckSeen, setForceRecheckSeen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScrapeResult | null>(null);

  const usingCustom = niche === '__custom__';
  const effectiveNiche = usingCustom ? customNiche.trim() : niche;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!effectiveNiche) {
      setError('Pick a niche or enter one.');
      return;
    }
    if (!location.trim()) {
      setError('Enter a city or neighborhood.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/scrape-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: effectiveNiche,
          location: location.trim(),
          targetCount,
          noWebsiteOnly,
          mobileOnly,
          forceRecheckSeen,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'request_failed');
      } else {
        setResult(data);
        router.refresh();
      }
    } catch {
      setError('network_error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-ink-900/10 p-5 sm:p-6">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink-700 mb-1">Niche</label>
          <select
            className="w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm bg-white"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            disabled={submitting}
          >
            {presets.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
            <option value="__custom__">Custom (free-text)…</option>
          </select>
          {usingCustom && (
            <input
              type="text"
              className="mt-2 w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
              placeholder="e.g. tattoo studio, nail salon"
              value={customNiche}
              onChange={(e) => setCustomNiche(e.target.value)}
              disabled={submitting}
            />
          )}
        </div>

        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-ink-700 mb-1">City / neighborhood</label>
          <input
            type="text"
            className="w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
            placeholder='e.g. "Bay Ridge, Brooklyn, NY"'
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={submitting}
          />
          <p className="mt-1 text-[11px] text-ink-700/50">
            Dedupe is keyed on this — same normalized city won&apos;t re-scrape the same places for 30 days.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-700 mb-1">Target lead count</label>
          <input
            type="number"
            min={1}
            max={100}
            className="w-full rounded-lg border border-ink-900/15 px-3 py-2 text-sm"
            value={targetCount}
            onChange={(e) => setTargetCount(Number(e.target.value))}
            disabled={submitting}
          />
        </div>

        <div className="space-y-2 self-end">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={noWebsiteOnly}
              onChange={(e) => setNoWebsiteOnly(e.target.checked)}
              disabled={submitting}
            />
            No-website only (include social-only)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mobileOnly}
              onChange={(e) => setMobileOnly(e.target.checked)}
              disabled={submitting}
            />
            Mobile-only phones (Twilio LTI)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={forceRecheckSeen}
              onChange={(e) => setForceRecheckSeen(e.target.checked)}
              disabled={submitting}
            />
            Force re-check seen places (ignore 30-day dedupe)
          </label>
        </div>

        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-ink-900 text-cream-50 px-5 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? 'Scraping…' : 'Run scrape'}
          </button>
          {error && <span className="text-sm text-red-700">{error}</span>}
        </div>
      </form>

      {result && (
        <div className="mt-6 border-t border-ink-900/10 pt-5">
          <div className="flex flex-wrap items-center gap-4 text-sm mb-4">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                result.status === 'success'
                  ? 'bg-emerald-50 text-emerald-700'
                  : result.status === 'partial'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-red-50 text-red-700'
              }`}
            >
              {result.status}
            </span>
            <span>
              <strong>{result.stats.leadsFound}</strong> new leads
            </span>
            <span className="text-ink-700/70">
              {result.stats.candidatesSeen} candidates · {result.stats.candidatesSkippedAsSeen} skipped (dedup) · {result.stats.placesApiCalls} Places calls · {result.stats.twilioApiCalls} Twilio calls
            </span>
            <a
              href={`/api/admin/scrape-leads/${result.runId}/csv`}
              className="ml-auto rounded-full border border-ink-900/15 px-3 py-1 text-xs font-semibold hover:bg-ink-900/5"
            >
              Download CSV
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-700/60 bg-ink-900/[0.02]">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Business</th>
                  <th className="text-left px-3 py-2 font-medium">Phone</th>
                  <th className="text-left px-3 py-2 font-medium">Address</th>
                  <th className="text-right px-3 py-2 font-medium">★</th>
                  <th className="text-left px-3 py-2 font-medium">Website</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-900/5">
                {result.leads.map((l) => (
                  <tr key={l.place_id}>
                    <td className="px-3 py-2 font-medium">{l.business_name}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="font-mono text-xs">{l.normalized_phone}</div>
                      <div className="text-[11px] text-ink-700/50">{l.phone}</div>
                    </td>
                    <td className="px-3 py-2 text-ink-700/80">{l.address}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {l.rating ?? '—'}
                      {l.review_count !== null && (
                        <span className="text-ink-700/50"> ({l.review_count})</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {l.uses_social_as_website ? (
                        <span className="text-amber-accent">social only</span>
                      ) : l.website_uri ? (
                        <span className="text-ink-700/50">{l.website_uri}</span>
                      ) : (
                        <span className="text-ink-700/40">none</span>
                      )}
                    </td>
                  </tr>
                ))}
                {result.leads.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-ink-700/50">
                      No new leads — try a different city or disable dedup.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
