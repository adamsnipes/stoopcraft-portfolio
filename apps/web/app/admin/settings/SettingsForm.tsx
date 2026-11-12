'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Setting = {
  key: string;
  label: string;
  value: string;
  help: string;
  type: 'percent' | 'text';
};

export function SettingsForm({ settings }: { settings: Setting[] }) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save(key: string, value: string) {
    setBusyKey(key);
    setErrors((e) => ({ ...e, [key]: '' }));
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors((e) => ({ ...e, [key]: data?.error ?? 'save_failed' }));
        return;
      }
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="bg-white border border-ink-900/10 rounded-2xl divide-y divide-ink-900/5">
      {settings.map((s) => (
        <SettingRow
          key={s.key}
          setting={s}
          busy={busyKey === s.key}
          error={errors[s.key]}
          onSave={(v) => save(s.key, v)}
        />
      ))}
    </div>
  );
}

function SettingRow({
  setting,
  busy,
  error,
  onSave,
}: {
  setting: Setting;
  busy: boolean;
  error?: string;
  onSave: (value: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(setting.value);
  const dirty = draft !== setting.value;

  return (
    <div className="p-4 flex flex-col md:flex-row md:items-start gap-4">
      <div className="md:w-1/2">
        <div className="font-medium">{setting.label}</div>
        <div className="text-xs text-ink-700/60 mt-1">{setting.help}</div>
        <div className="text-[10px] text-ink-700/40 mt-1 font-mono">{setting.key}</div>
      </div>
      <div className="md:w-1/2 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {setting.type === 'percent' ? (
            <div className="relative flex-1">
              <input
                type="number"
                min={0}
                max={100}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full border border-ink-900/10 rounded-lg pl-3 pr-8 py-2 bg-cream-50 text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-700/60">%</span>
            </div>
          ) : (
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 border border-ink-900/10 rounded-lg px-3 py-2 bg-cream-50 text-sm"
            />
          )}
          <button
            onClick={() => onSave(draft)}
            disabled={busy || !dirty}
            className="bg-ink-900 text-cream-50 px-3 py-2 rounded-lg text-sm font-medium hover:bg-ink-800 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
        {error && <p className="text-red-700 text-xs">{error}</p>}
      </div>
    </div>
  );
}
