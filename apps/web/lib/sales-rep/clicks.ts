// Aggregates click + conversion data for the rep/affiliate dashboard.
// Backing data:
//   - events with type='rep_ref_click', metadata.sales_rep_id = rep
//   - clients with sales_rep_id = rep (the conversions)
// Click events also carry metadata.utm_source so we can break out
// per-channel performance.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@dfy/db';

type Admin = SupabaseClient<Database>;

export type ClickStats = {
  total: number;
  mtd: number;
  today: number;
  // Last 30 days as YYYY-MM-DD → count. Sparse — only days with clicks.
  daily: Record<string, number>;
};

export type ChannelStat = {
  source: string;
  clicks: number;
  conversions: number;
  // Paying customers — claimed and not cancelled.
  paying: number;
};

export type FunnelStats = {
  clicks: ClickStats;
  // Total clients attributed (any status, claimed or not).
  conversions_total: number;
  // Currently paying customers (status='claimed', cancelled_at IS NULL).
  conversions_paying: number;
  conversion_rate: number;
  channels: ChannelStat[];
};

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function thirtyDaysAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getFunnelStats(
  admin: Admin,
  salesRepId: string,
): Promise<FunnelStats> {
  // Total click count comes from a dedicated count query so the headline
  // number is exact even past PostgREST's default 1000-row response cap.
  const { count: totalClicksRaw } = await admin
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'rep_ref_click')
    .filter('metadata->>sales_rep_id', 'eq', salesRepId);

  // Per-channel + daily breakdowns need actual rows. range() bumps the
  // limit past the default — 50k is enough for any plausible affiliate;
  // anyone past that warrants a proper Postgres aggregate function.
  const { data: clickRows } = await admin
    .from('events')
    .select('created_at, metadata')
    .eq('type', 'rep_ref_click')
    .filter('metadata->>sales_rep_id', 'eq', salesRepId)
    .range(0, 49999);

  // Clients attributed to this rep — drives conversion + per-channel.
  const { data: clientRows } = await admin
    .from('clients')
    .select('id, status, cancelled_at, referral_utm_source')
    .eq('sales_rep_id', salesRepId);

  const clicks = clickRows ?? [];
  const clients = clientRows ?? [];
  const totalClicks = totalClicksRaw ?? clicks.length;

  const todayCutoff = new Date(startOfTodayIso()).getTime();
  const mtdCutoff = new Date(startOfMonthIso()).getTime();
  const thirtyCutoff = new Date(thirtyDaysAgoIso()).getTime();

  let today = 0;
  let mtd = 0;
  const daily: Record<string, number> = {};

  for (const row of clicks) {
    const ts = new Date(row.created_at).getTime();
    if (ts >= todayCutoff) today++;
    if (ts >= mtdCutoff) mtd++;
    if (ts >= thirtyCutoff) {
      const day = row.created_at.slice(0, 10);
      daily[day] = (daily[day] ?? 0) + 1;
    }
  }

  // Per-channel: clicks come from event.metadata.utm_source, conversions
  // come from clients.referral_utm_source. We surface every source we
  // saw on either side so a click-no-conversion source still shows.
  const channelMap = new Map<string, ChannelStat>();
  function bumpClick(source: string) {
    const cur = channelMap.get(source) ?? { source, clicks: 0, conversions: 0, paying: 0 };
    cur.clicks++;
    channelMap.set(source, cur);
  }
  function bumpConv(source: string, isPaying: boolean) {
    const cur = channelMap.get(source) ?? { source, clicks: 0, conversions: 0, paying: 0 };
    cur.conversions++;
    if (isPaying) cur.paying++;
    channelMap.set(source, cur);
  }

  for (const row of clicks) {
    const meta = (row.metadata ?? {}) as { utm_source?: string };
    const src = meta.utm_source ?? '(direct)';
    bumpClick(src);
  }
  for (const c of clients) {
    const src = c.referral_utm_source ?? '(direct)';
    const isPaying = c.status === 'claimed' && c.cancelled_at == null;
    bumpConv(src, isPaying);
  }

  const channels = Array.from(channelMap.values()).sort((a, b) => b.clicks - a.clicks);

  const conversionsTotal = clients.length;
  const conversionsPaying = clients.filter(
    (c) => c.status === 'claimed' && c.cancelled_at == null,
  ).length;
  const conversion_rate = totalClicks > 0 ? conversionsTotal / totalClicks : 0;

  return {
    clicks: { total: totalClicks, mtd, today, daily },
    conversions_total: conversionsTotal,
    conversions_paying: conversionsPaying,
    conversion_rate,
    channels,
  };
}

// Sparkline helper: dense 30-day series (oldest → newest) so the UI can
// render bars without doing date-math itself.
export function densify30Days(daily: Record<string, number>): { day: string; count: number }[] {
  const out: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, count: daily[key] ?? 0 });
  }
  return out;
}
