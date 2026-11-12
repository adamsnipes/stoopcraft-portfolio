'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { Card, PageHeader, field } from '../ui';
import { buildSections, type SopConfig } from './sop-data';

/**
 * The SOP, rendered as a working checklist.
 *
 * Tick state is per-client and lives in localStorage — deliberately, so this
 * ships without a migration. It follows the browser, not the account: two
 * people onboarding the same client see separate progress. If that starts
 * mattering (i.e. more than one person doing onboarding), move `done` into a
 * jsonb column on `clients` and drop the storage layer.
 */

type ClientOption = { id: string; business_name: string; status: string };
type Ticks = Record<string, boolean>;

const STORAGE_PREFIX = 'stoop.sop.v1:';

/* -------------------------------------------------------------------------- */
/* localStorage as an external store                                           */
/*                                                                             */
/* Read through useSyncExternalStore rather than an effect: the server renders  */
/* EMPTY, hydration matches, and React re-reads once mounted. The cache keeps   */
/* getSnapshot referentially stable, which it must be or React loops.           */
/* -------------------------------------------------------------------------- */

const EMPTY: Ticks = {};
const listeners = new Set<() => void>();
let cache: { key: string; value: Ticks } | null = null;

function readTicks(key: string): Ticks {
  if (cache?.key === key) return cache.value;
  let value: Ticks = EMPTY;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) value = JSON.parse(raw) as Ticks;
  } catch {
    /* unparseable or unavailable — start clean */
  }
  cache = { key, value };
  return value;
}

function writeTicks(key: string, value: Ticks) {
  cache = { key, value };
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — the checklist still works for this session */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function SopBoard({ config, clients }: { config: SopConfig; clients: ClientOption[] }) {
  const sections = useMemo(() => buildSections(config), [config]);
  const allStepIds = useMemo(() => sections.flatMap((s) => s.steps.map((st) => st.id)), [sections]);

  const [runId, setRunId] = useState('general');
  const storageKey = STORAGE_PREFIX + runId;
  const done = useSyncExternalStore(
    subscribe,
    () => readTicks(storageKey),
    () => EMPTY,
  );

  function toggle(id: string) {
    writeTicks(storageKey, { ...done, [id]: !done[id] });
  }

  function reset() {
    const label = clients.find((c) => c.id === runId)?.business_name ?? 'this checklist';
    if (!confirm(`Clear all ticks for ${label}?`)) return;
    writeTicks(storageKey, {});
  }

  const completed = allStepIds.filter((id) => done[id]).length;

  return (
    <div>
      <PageHeader
        title="Onboarding SOP"
        description="What has to happen once a new client's site is built. Work top to bottom."
        actions={
          <select
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            className={`${field} max-w-[220px]`}
            aria-label="Track progress for"
          >
            <option value="general">Reference only (no client)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.business_name}
              </option>
            ))}
          </select>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-ink-900/10 bg-white px-4 py-3">
        <div className="flex min-w-[180px] flex-1 items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-900/[0.07]">
            <div
              className="h-full rounded-full bg-amber-accent transition-[width] duration-300"
              style={{ width: `${allStepIds.length ? (completed / allStepIds.length) * 100 : 0}%` }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-ink-700/70">
            {completed}/{allStepIds.length}
          </span>
        </div>
        <p className="text-xs text-ink-700/55">
          {runId === 'general'
            ? 'Pick a client above to keep progress against them.'
            : 'Saved in this browser only.'}
        </p>
        {completed > 0 && (
          <button type="button" onClick={reset} className="text-xs text-ink-700 hover:underline">
            Reset
          </button>
        )}
      </div>

      <div className="max-w-3xl space-y-5">
        {sections.map((section, i) => (
          <Card key={section.id} className="p-5 sm:p-6">
            <header className="mb-4">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                <span className="mr-2 text-ink-700/35 tabular-nums">{i + 1}</span>
                {section.title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-700/70">{section.purpose}</p>
            </header>

            <ol className="space-y-3">
              {section.steps.map((step) => {
                const checked = !!done[step.id];
                return (
                  <li
                    key={step.id}
                    className="flex gap-3 border-t border-ink-900/[0.07] pt-3 first:border-0 first:pt-0"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(step.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-amber-accent"
                      aria-label="Mark step done"
                    />
                    <div className={`min-w-0 flex-1 ${checked ? 'opacity-45' : ''}`}>
                      <div className="text-sm leading-relaxed text-ink-900">
                        {step.title}
                        {step.optional && (
                          <span className="ml-1.5 text-[11px] uppercase tracking-wide text-ink-700/45">
                            if applicable
                          </span>
                        )}
                      </div>
                      {step.body && (
                        <div className="mt-2 space-y-2 text-xs leading-relaxed text-ink-700 [&_p]:text-ink-700/85">
                          {step.body}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        ))}
      </div>
    </div>
  );
}
