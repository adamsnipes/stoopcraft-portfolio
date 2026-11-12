// Thin wrapper over the Search Console API (webmasters/v3).
// Only the two endpoints the reports need: sites.list and searchAnalytics.query.

import { getAccessToken } from './auth';

const API_BASE = 'https://searchconsole.googleapis.com/webmasters/v3';

export type GscDimension = 'query' | 'page' | 'date' | 'country' | 'device';

export type GscRow = {
  /** One entry per requested dimension, in the order they were requested.
   *  Absent when the query asked for totals (no dimensions). */
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscProperty = {
  siteUrl: string;
  permissionLevel: 'siteOwner' | 'siteFullUser' | 'siteRestrictedUser' | 'siteUnverifiedUser' | string;
};

/** A non-2xx from the Search Console API, with the status preserved so callers
 *  can distinguish "not added to this property" (403) from "no such property"
 *  (404) and surface an actionable message in admin. */
export class GscApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public property?: string,
  ) {
    super(`Search Console API ${status}: ${detail}`);
    this.name = 'GscApiError';
  }

  /** Operator-facing explanation of the common failure modes. */
  get hint(): string {
    if (this.status === 403) {
      return 'The service account is not a user on this property. Add it in Search Console → Settings → Users and permissions.';
    }
    if (this.status === 404) {
      return 'No such property. Check the exact ID — "sc-domain:example.com" and "https://example.com/" are different properties.';
    }
    if (this.status === 429) return 'Rate limited by Google. Retry in a minute.';
    return this.detail;
  }
}

async function apiFetch<T>(path: string, init: RequestInit, property?: string): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new GscApiError(res.status, body?.error?.message ?? `HTTP ${res.status}`, property);
  }

  return (await res.json()) as T;
}

/**
 * Every property the service account can see. This is also the operator's
 * connection check: a client whose domain is absent here was never added to
 * the agency account (or the service account was never granted access to it).
 */
export async function listProperties(): Promise<GscProperty[]> {
  const data = await apiFetch<{ siteEntry?: GscProperty[] }>('/sites', { method: 'GET' });
  return (data.siteEntry ?? []).filter((p) => p.permissionLevel !== 'siteUnverifiedUser');
}

export type SearchAnalyticsOptions = {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dimensions?: GscDimension[];
  rowLimit?: number;
  /** 'final' excludes the most recent, still-incomplete days. 'all' includes
   *  them. We use 'final' so period-over-period comparisons aren't skewed by a
   *  partially-collected tail. */
  dataState?: 'final' | 'all';
  type?: 'web' | 'image' | 'video' | 'news' | 'discover' | 'googleNews';
};

/**
 * Search Analytics query.
 *
 * Note on totals: rows returned with dimensions=['query'] do NOT sum to the
 * property totals, because Google withholds queries issued by too few users
 * (anonymised queries). Always fetch headline numbers with dimensions omitted
 * rather than summing the query rows.
 */
export async function searchAnalytics(
  property: string,
  opts: SearchAnalyticsOptions,
): Promise<GscRow[]> {
  const data = await apiFetch<{ rows?: GscRow[] }>(
    `/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        startDate: opts.startDate,
        endDate: opts.endDate,
        dimensions: opts.dimensions ?? [],
        rowLimit: opts.rowLimit ?? 1000,
        dataState: opts.dataState ?? 'final',
        type: opts.type ?? 'web',
      }),
    },
    property,
  );
  return data.rows ?? [];
}
