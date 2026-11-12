import type { Metadata } from 'next';
import { SETTING_KEYS, getSetting } from '@/lib/platform-settings';
import { SettingsForm } from './SettingsForm';

export const metadata: Metadata = { title: 'Settings' };

// Each form section pulls its current value here (server) and renders an
// inline-editable input. Save flows through PATCH /api/admin/settings.
//
// Add a new setting by:
//   1. inserting a row in a migration
//   2. extending SETTING_KEYS in lib/platform-settings.ts
//   3. adding a SettingsForm row below
export default async function AdminSettingsPage() {
  const affiliatePct = await getSetting(SETTING_KEYS.AFFILIATE_DEFAULT_COMMISSION_PCT);
  const repPct = await getSetting(SETTING_KEYS.REP_DEFAULT_COMMISSION_PCT);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-light tracking-tight">Settings</h1>
        <p className="text-sm text-ink-700 mt-1">
          Runtime-tunable knobs. Changes take effect immediately — no deploy.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-display text-xl tracking-tight">Commission defaults</h2>
        <p className="text-sm text-ink-700/70 max-w-2xl">
          Default commission % stamped onto new signups. Existing reps and affiliates keep their
          per-row rate — change those individually from{' '}
          <a href="/admin/reps" className="underline">
            /admin/reps
          </a>{' '}
          if you need to.
        </p>

        <SettingsForm
          settings={[
            {
              key: SETTING_KEYS.AFFILIATE_DEFAULT_COMMISSION_PCT,
              label: 'Affiliate default commission %',
              value: affiliatePct,
              help: 'Applied to new /affiliates signups. Drives the displayed % on /affiliates for logged-out visitors.',
              type: 'percent',
            },
            {
              key: SETTING_KEYS.REP_DEFAULT_COMMISSION_PCT,
              label: 'Sales-rep default commission %',
              value: repPct,
              help: 'Applied to new /reps signups (the active-outreach program).',
              type: 'percent',
            },
          ]}
        />
      </section>
    </div>
  );
}
