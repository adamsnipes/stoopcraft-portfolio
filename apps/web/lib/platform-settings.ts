// Platform settings — runtime-tunable knobs editable from /admin/settings,
// no code deploy required. Backed by the platform_settings table (key/value
// pairs). Service-role access only; never expose to client code.
//
// Add a new setting by:
//   1. inserting a row in a new migration
//   2. extending SETTING_KEYS + DEFAULTS here
//   3. surfacing a control on /admin/settings if it's admin-editable

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@dfy/db';
import { createServiceRoleClient } from '@/lib/supabase/server';

type Admin = SupabaseClient<Database>;

export const SETTING_KEYS = {
  AFFILIATE_DEFAULT_COMMISSION_PCT: 'affiliate_default_commission_pct',
  REP_DEFAULT_COMMISSION_PCT: 'rep_default_commission_pct',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

// Last-resort defaults. The DB seed sets these, but if the row is missing
// for any reason (rolled-back migration, fresh local DB without seed) we
// fall back to these so the app never crashes on a missing setting.
const DEFAULTS: Record<SettingKey, string> = {
  [SETTING_KEYS.AFFILIATE_DEFAULT_COMMISSION_PCT]: '30',
  [SETTING_KEYS.REP_DEFAULT_COMMISSION_PCT]: '50',
};

export async function getSetting(key: SettingKey, admin?: Admin): Promise<string> {
  const client = admin ?? createServiceRoleClient();
  const { data } = await client
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? DEFAULTS[key];
}

export async function getSettingInt(
  key: SettingKey,
  admin?: Admin,
): Promise<number> {
  const raw = await getSetting(key, admin);
  const n = parseInt(raw, 10);
  if (Number.isFinite(n)) return n;
  // Bad data in the DB — fall back to the hardcoded default rather than NaN.
  const fallback = parseInt(DEFAULTS[key], 10);
  return Number.isFinite(fallback) ? fallback : 0;
}

export async function setSetting(opts: {
  key: SettingKey;
  value: string;
  userId: string | null;
}): Promise<void> {
  const admin = createServiceRoleClient();
  await admin.from('platform_settings').upsert(
    {
      key: opts.key,
      value: opts.value,
      updated_by: opts.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );
}

// Sugar for the most common consumer: pick a default commission % by kind.
export async function getDefaultCommissionPct(
  kind: 'rep' | 'affiliate',
  admin?: Admin,
): Promise<number> {
  const key =
    kind === 'affiliate'
      ? SETTING_KEYS.AFFILIATE_DEFAULT_COMMISSION_PCT
      : SETTING_KEYS.REP_DEFAULT_COMMISSION_PCT;
  return getSettingInt(key, admin);
}

export async function getAllSettings(): Promise<
  { key: string; value: string; description: string | null; updated_at: string }[]
> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from('platform_settings')
    .select('key, value, description, updated_at')
    .order('key', { ascending: true });
  return data ?? [];
}
