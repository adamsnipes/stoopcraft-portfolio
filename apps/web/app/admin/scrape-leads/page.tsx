import type { Metadata } from 'next';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { NICHE_PRESETS } from '@/lib/lead-scraping/niches';
import { ScrapeLeadsForm } from './ScrapeLeadsForm';
import { Badge, Card, PageHeader, SectionHeading, type Tone, tdClass, thClass } from '../ui';

export const metadata: Metadata = { title: 'Scrape Leads' };

export default async function ScrapeLeadsPage() {
  const sb = createServiceRoleClient();
  const { data: recentRuns } = await sb
    .from('scrape_runs')
    .select(
      'id, niche, location_input, target_count, leads_found, candidates_seen, candidates_skipped_seen, places_api_calls, twilio_api_calls, status, started_at',
    )
    .order('started_at', { ascending: false })
    .limit(15);

  const presets = Object.values(NICHE_PRESETS).map((p) => ({
    key: p.key,
    label: p.displayName,
  }));

  return (
    <div>
      <PageHeader
        title="Scrape Leads"
        description="Pull local businesses without real websites from Google Places, filter to mobile-only numbers via Twilio LTI, dedupe per (niche, city), and export to CSV for outbound."
      />

      <ScrapeLeadsForm presets={presets} />

      <div className="mt-10">
        <SectionHeading>Recent runs</SectionHeading>
      </div>
      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-900/10 bg-cream-100/50">
            <tr>
              <th className={thClass}>When</th>
              <th className={thClass}>Niche</th>
              <th className={thClass}>Location</th>
              <th className={`${thClass} text-right`}>Leads</th>
              <th className={`${thClass} text-right`}>Seen</th>
              <th className={`${thClass} text-right`}>Skipped</th>
              <th className={`${thClass} text-right`}>Places calls</th>
              <th className={`${thClass} text-right`}>Twilio calls</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>CSV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-900/5">
            {(recentRuns ?? []).map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-cream-100/50">
                <td className={`${tdClass} whitespace-nowrap text-ink-700/80`}>
                  {new Date(r.started_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className={tdClass}>{r.niche}</td>
                <td className={tdClass}>{r.location_input}</td>
                <td className={`${tdClass} text-right tabular-nums`}>
                  {r.leads_found}/{r.target_count}
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>{r.candidates_seen}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{r.candidates_skipped_seen}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{r.places_api_calls}</td>
                <td className={`${tdClass} text-right tabular-nums`}>{r.twilio_api_calls}</td>
                <td className={tdClass}>
                  <Badge tone={RUN_TONE[r.status] ?? 'red'} className="capitalize">
                    {r.status}
                  </Badge>
                </td>
                <td className={tdClass}>
                  {r.leads_found > 0 ? (
                    <a
                      href={`/api/admin/scrape-leads/${r.id}/csv`}
                      className="text-xs font-medium text-amber-accent hover:underline"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-xs text-ink-700/30">—</span>
                  )}
                </td>
              </tr>
            ))}
            {(recentRuns ?? []).length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-ink-700/50">
                  No runs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}

const RUN_TONE: Record<string, Tone> = {
  success: 'green',
  partial: 'amber',
  running: 'accent',
};
