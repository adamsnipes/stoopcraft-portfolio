'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Small presentational pieces the SOP content is written with. Split out of
 * SopBoard so `sop-data.tsx` can use them without importing the board back
 * (circular import).
 */

/** Click-to-copy value chip — for DNS targets, records, IDs. */
export function Copy({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex max-w-full items-center gap-1.5 rounded border border-ink-900/12 bg-ink-900/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-ink-900 transition-colors hover:bg-ink-900/[0.07]"
      title="Copy"
    >
      <span className="truncate">{label ?? value}</span>
      <span className={copied ? 'text-emerald-600' : 'text-ink-700/40'}>{copied ? '✓' : '⎘'}</span>
    </button>
  );
}

/** A DNS-style row: TYPE  host → value. */
export function Record({ type, host, value }: { type: string; host: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-ink-700">
      <span className="inline-block w-12 shrink-0 font-semibold text-ink-900">{type}</span>
      <span className="text-ink-700/70">{host}</span>
      <span className="text-ink-900/25">→</span>
      <Copy value={value} />
    </div>
  );
}

/** Multi-line block with a copy button in the corner. */
export function Block({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="max-h-64 overflow-auto rounded-lg border border-ink-900/10 bg-ink-900/[0.03] p-3 pr-16 font-mono text-[11px] leading-relaxed text-ink-900">
        {code}
      </pre>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 rounded border border-ink-900/12 bg-white px-1.5 py-0.5 text-[11px] text-ink-700 hover:bg-cream-100"
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  );
}

/** The thing that bites you. Kept visually loud on purpose. */
export function Gotcha({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-600/20 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
      <span className="font-semibold">Gotcha — </span>
      {children}
    </div>
  );
}

/** Inline monospace, for field names and UI labels. */
export function M({ children }: { children: ReactNode }) {
  return <code className="rounded bg-ink-900/[0.05] px-1 py-px font-mono text-[11px]">{children}</code>;
}
