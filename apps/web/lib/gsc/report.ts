// Shapes raw Search Console rows into the report we actually send a client.
//
// Deliberately more than a screenshot of the GSC overview: alongside the
// headline four (clicks / impressions / CTR / position) it carries
// period-over-period deltas, the queries that are NEW this period, the ones
// sitting just off page one, and — where the site emits events — the join from
// Google impressions all the way through to contact clicks. That last one is
// the part no stock GSC export can show.

import { createServiceRoleClient } from '@/lib/supabase/server';
import { clientDisplayName } from '@/lib/client-display';
import { searchAnalytics, type GscRow } from './client';

/** Search Console finalises data ~2–3 days behind. Ending the window short of
 *  that keeps the last days of the range from reading as a traffic collapse. */
const LAG_DAYS = 3;
const DEFAULT_DAYS = 90;

export class GscNotConnectedError extends Error {
  constructor(public clientId: string) {
    super('This client has no Search Console property linked.');
    this.name = 'GscNotConnectedError';
  }
}

export type Metric = {
  clicks: number;
  impressions: number;
  /** Fraction 0–1, as returned by the API. */
  ctr: number;
  position: number;
};

export type QueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  /** Average position in the comparison period; null if it didn't rank then. */
  previousPosition: number | null;
  /** Positive = moved UP the results page (8 → 5 is +3). Null when new. */
  positionChange: number | null;
  isNew: boolean;
};

export type PageRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SeoReport = {
  clientId: string;
  businessName: string;
  property: string;
  range: { start: string; end: string; label: string };
  previousRange: { start: string; end: string };
  totals: Metric;
  previousTotals: Metric;
  /** Percent change vs the previous period for clicks/impressions/ctr, and an
   *  absolute position change (positive = improved). Null when the previous
   *  period had nothing to compare against. */
  change: {
    clicksPct: number | null;
    impressionsPct: number | null;
    ctrPct: number | null;
    position: number | null;
  };
  topQueries: QueryRow[];
  /** Clicks Google attributes to named queries, summed across ALL query rows —
   *  not just the top ten. Google withholds queries issued by too few users, so
   *  this is routinely lower than totals.clicks, and on low-traffic sites it is
   *  often zero while the headline shows real clicks. The email compares the
   *  two and explains the gap rather than letting it read as a contradiction. */
  namedQueryClicks: number;
  newQueries: QueryRow[];
  /** Positions 11–20: ranking, but on page two. The content-work upsell. */
  strikingDistance: QueryRow[];
  topPages: PageRow[];
  /** Clicks + impressions bucketed by calendar month, for the trend bars. */
  monthly: { month: string; label: string; clicks: number; impressions: number }[];
  /** On-site numbers for the same window. Null when the site emits no events
   *  (static HTML builds don't), so the section can be dropped entirely. */
  funnel: { pageViews: number; contactClicks: number; bookingClicks: number } | null;
};

// ---------------------------------------------------------------------------
// Date helpers — all UTC. GSC buckets by Pacific time, but a day's drift at
// the window edge doesn't matter for a 90-day comparison.
// ---------------------------------------------------------------------------

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
}

function rangeLabel(start: Date, end: Date): string {
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' as const } : {}),
      timeZone: 'UTC',
    });
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  return `${fmt(start, !sameYear)} – ${fmt(end, true)}`;
}

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------

const ZERO: Metric = { clicks: 0, impressions: 0, ctr: 0, position: 0 };

function toMetric(rows: GscRow[]): Metric {
  const row = rows[0];
  if (!row) return ZERO;
  return { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // null renders as "new", not "+∞%"
  return ((current - previous) / previous) * 100;
}

function keyOf(row: GscRow): string {
  return row.keys?.[0] ?? '';
}

/** Joins a current-period query row against the previous period. */
function toQueryRow(row: GscRow, previous: Map<string, GscRow>): QueryRow {
  const query = keyOf(row);
  const prev = previous.get(query);
  return {
    query,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
    previousPosition: prev ? prev.position : null,
    // Lower position number is better, so previous - current is the gain.
    positionChange: prev ? prev.position - row.position : null,
    isNew: !prev,
  };
}

// ---------------------------------------------------------------------------

export async function buildSeoReport(
  clientId: string,
  opts: { days?: number } = {},
): Promise<SeoReport> {
  const days = opts.days ?? DEFAULT_DAYS;
  const admin = createServiceRoleClient();

  const { data: client, error } = await admin
    .from('clients')
    .select('id, business_name, slug, custom_domain, gsc_property')
    .eq('id', clientId)
    .single();

  if (error || !client) throw new Error(`No such client: ${clientId}`);
  if (!client.gsc_property) throw new GscNotConnectedError(clientId);

  const property = client.gsc_property;

  const end = addDays(new Date(), -LAG_DAYS);
  const start = addDays(end, -(days - 1));
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(days - 1));

  const current = { startDate: ymd(start), endDate: ymd(end) };
  const previous = { startDate: ymd(previousStart), endDate: ymd(previousEnd) };

  const [totalRows, previousTotalRows, queryRows, previousQueryRows, pageRows, dailyRows, funnel] =
    await Promise.all([
      searchAnalytics(property, current),
      searchAnalytics(property, previous),
      searchAnalytics(property, { ...current, dimensions: ['query'], rowLimit: 1000 }),
      searchAnalytics(property, { ...previous, dimensions: ['query'], rowLimit: 1000 }),
      searchAnalytics(property, { ...current, dimensions: ['page'], rowLimit: 25 }),
      searchAnalytics(property, { ...current, dimensions: ['date'], rowLimit: 500 }),
      fetchFunnel(clientId, start, end),
    ]);

  const totals = toMetric(totalRows);
  const previousTotals = toMetric(previousTotalRows);

  const previousByQuery = new Map(previousQueryRows.map((r) => [keyOf(r), r]));
  const joined = queryRows.map((r) => toQueryRow(r, previousByQuery));

  const topQueries = [...joined].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions).slice(0, 10);

  // "New" is only interesting if it's actually getting seen — a single
  // impression from one search isn't worth telling a client about.
  const newQueries = joined
    .filter((q) => q.isNew && q.impressions >= 10)
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 10);

  const strikingDistance = joined
    .filter((q) => q.position > 10 && q.position <= 20 && q.impressions >= 10)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  const topPages: PageRow[] = pageRows
    .slice(0, 10)
    .map((r) => ({
      page: keyOf(r),
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }));

  return {
    clientId,
    businessName: clientDisplayName(client),
    property,
    range: { ...toRange(current), label: rangeLabel(start, end) },
    previousRange: toRange(previous),
    totals,
    previousTotals,
    change: {
      clicksPct: pctChange(totals.clicks, previousTotals.clicks),
      impressionsPct: pctChange(totals.impressions, previousTotals.impressions),
      ctrPct: pctChange(totals.ctr, previousTotals.ctr),
      position: previousTotals.position ? previousTotals.position - totals.position : null,
    },
    topQueries,
    namedQueryClicks: joined.reduce((sum, q) => sum + q.clicks, 0),
    newQueries,
    strikingDistance,
    topPages,
    monthly: bucketByMonth(dailyRows),
    funnel,
  };
}

function toRange(r: { startDate: string; endDate: string }): { start: string; end: string } {
  return { start: r.startDate, end: r.endDate };
}

function bucketByMonth(rows: GscRow[]): SeoReport['monthly'] {
  const buckets = new Map<string, { clicks: number; impressions: number }>();
  for (const row of rows) {
    const date = keyOf(row);
    if (!date) continue;
    const month = date.slice(0, 7); // YYYY-MM
    const bucket = buckets.get(month) ?? { clicks: 0, impressions: 0 };
    bucket.clicks += row.clicks;
    bucket.impressions += row.impressions;
    buckets.set(month, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totals]) => ({
      month,
      label: new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        timeZone: 'UTC',
      }),
      ...totals,
    }));
}

/**
 * On-site counts for the same window, from the events table. Returns null when
 * the site records nothing — static HTML builds have no event beacon, and a
 * funnel of all zeros reads worse than no funnel at all.
 */
async function fetchFunnel(
  clientId: string,
  start: Date,
  end: Date,
): Promise<SeoReport['funnel']> {
  const admin = createServiceRoleClient();
  const from = start.toISOString();
  // end is a date boundary; include the whole final day.
  const to = addDays(end, 1).toISOString();

  const count = async (type: string) => {
    const { count: n } = await admin
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('type', type)
      .gte('created_at', from)
      .lt('created_at', to);
    return n ?? 0;
  };

  const [pageViews, contactClicks, bookingClicks] = await Promise.all([
    count('page_view'),
    count('contact_click'),
    count('booking_click'),
  ]);

  if (pageViews === 0 && contactClicks === 0 && bookingClicks === 0) return null;
  return { pageViews, contactClicks, bookingClicks };
}
