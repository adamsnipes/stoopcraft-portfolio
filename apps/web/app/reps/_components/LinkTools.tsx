'use client';

// Affiliate link toolkit — UTM-tagged variant generator + copy button.
// Surfaced on /reps overview. Pure client component; the QR code is rendered
// server-side (no client-bundle weight) and passed in as a data URL.

import { useMemo, useState } from 'react';

const PRESET_SOURCES: { key: string; label: string }[] = [
  { key: 'twitter', label: 'Twitter / X' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'newsletter', label: 'Newsletter / email' },
  { key: 'blog', label: 'Blog post' },
  { key: 'discord', label: 'Discord / Slack' },
  { key: 'facebook', label: 'Facebook' },
];

function sanitize(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 40);
}

export function LinkTools({
  baseLink,
  qrPngDataUrl,
}: {
  baseLink: string;
  qrPngDataUrl: string;
}) {
  const [source, setSource] = useState<string>('twitter');
  const [custom, setCustom] = useState<string>('');
  const [copied, setCopied] = useState<string | null>(null);

  const taggedLink = useMemo(() => {
    const value = source === 'custom' ? sanitize(custom) : source;
    return value ? `${baseLink}?utm_source=${value}` : baseLink;
  }, [baseLink, source, custom]);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
    } catch {
      /* user can still select-copy */
    }
  }

  return (
    <div className="bg-white border border-ink-900/10 rounded-2xl p-5 space-y-5">
      <div>
        <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">
          Your referral link
        </div>
        <div className="flex gap-2 mt-2">
          <input
            readOnly
            value={baseLink}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 border border-ink-900/10 rounded-lg px-3 py-2 bg-cream-50 text-sm font-mono"
          />
          <button
            onClick={() => copy(baseLink, 'base')}
            className="bg-ink-900 text-cream-50 px-3 py-2 rounded-lg text-sm font-medium hover:bg-ink-800"
          >
            {copied === 'base' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-ink-700/60 mt-2">
          Attributes anyone who clicks for 30 days. Drop it anywhere.
        </p>
      </div>

      <hr className="border-ink-900/5" />

      <div>
        <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">
          Tagged link — track per channel
        </div>
        <p className="text-xs text-ink-700/60 mt-1">
          Pick where you&apos;re posting. The dashboard breaks clicks &amp; conversions
          down by source so you can see what&apos;s working.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {PRESET_SOURCES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSource(s.key)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                source === s.key
                  ? 'bg-amber-accent/10 border-amber-accent text-ink-900'
                  : 'bg-cream-50 border-ink-900/10 text-ink-700 hover:border-ink-900/20'
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSource('custom')}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              source === 'custom'
                ? 'bg-amber-accent/10 border-amber-accent text-ink-900'
                : 'bg-cream-50 border-ink-900/10 text-ink-700 hover:border-ink-900/20'
            }`}
          >
            Custom…
          </button>
        </div>
        {source === 'custom' && (
          <input
            value={custom}
            onChange={(e) => setCustom(sanitize(e.target.value))}
            placeholder="e.g. podcast"
            className="w-full mt-3 border border-ink-900/10 rounded-lg px-3 py-2 bg-cream-50 text-sm"
          />
        )}
        <div className="flex gap-2 mt-3">
          <input
            readOnly
            value={taggedLink}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 border border-ink-900/10 rounded-lg px-3 py-2 bg-cream-50 text-sm font-mono"
          />
          <button
            onClick={() => copy(taggedLink, 'tagged')}
            disabled={source === 'custom' && !custom}
            className="bg-ink-900 text-cream-50 px-3 py-2 rounded-lg text-sm font-medium hover:bg-ink-800 disabled:opacity-50"
          >
            {copied === 'tagged' ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <hr className="border-ink-900/5" />

      <div>
        <div className="text-xs uppercase tracking-wider text-ink-700/60 font-semibold">
          QR code
        </div>
        <p className="text-xs text-ink-700/60 mt-1">
          For in-person, flyers, business cards, sticker drops.
        </p>
        <div className="flex items-start gap-4 mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrPngDataUrl}
            alt="Referral link QR code"
            width={140}
            height={140}
            className="rounded-lg border border-ink-900/10 bg-white"
          />
          <a
            download="stoopcraft-referral-qr.png"
            href={qrPngDataUrl}
            className="bg-ink-900 text-cream-50 px-3 py-2 rounded-lg text-sm font-medium hover:bg-ink-800 self-start"
          >
            Download PNG
          </a>
        </div>
      </div>
    </div>
  );
}
