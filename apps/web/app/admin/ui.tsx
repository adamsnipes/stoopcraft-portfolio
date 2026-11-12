/**
 * Admin design primitives.
 * ----------------------------------------------------------------------------
 * Every /admin page composes from this file so the dashboard reads as one
 * product instead of five pages that drifted apart. Before this existed the
 * pages disagreed on heading size (text-2xl bold vs. text-3xl light), card
 * radius (rounded-xl vs. rounded-2xl) and even color family (raw `gray-*` vs.
 * the `ink-*` brand tokens).
 *
 * These are server-safe (no 'use client') so server components can use them
 * directly. Interactive bits live in their own client files.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

/* -------------------------------------------------------------------------- */
/* Page chrome                                                                 */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  stats,
  actions,
}: {
  title: string;
  description?: ReactNode;
  /** Compact at-a-glance numbers — render <Stat /> children. */
  stats?: ReactNode;
  /** Primary page action(s), right-aligned. */
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-700/70">{description}</p>
        )}
        {stats && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">{stats}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-display text-lg font-semibold tabular-nums leading-none">{value}</span>
      <span className="text-xs font-medium uppercase tracking-wide text-ink-700/55">{label}</span>
    </span>
  );
}

export function SectionHeading({
  children,
  count,
  action,
}: {
  children: ReactNode;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-base font-semibold tracking-tight">
        {children}
        {count !== undefined && (
          <span className="ml-2 text-sm font-normal tabular-nums text-ink-700/50">{count}</span>
        )}
      </h2>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                    */
/* -------------------------------------------------------------------------- */

/** Standard white surface. `padded={false}` for tables that own their padding. */
export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-ink-900/10 bg-white shadow-[0_1px_2px_rgba(10,10,10,0.04)] ${
        padded ? 'p-5' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * A titled settings block. Matches the shape the self-wrapping panels under
 * clients/[id]/ already render, so mixing the two reads as one stack.
 */
export function Panel({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="mb-4 p-6">
      <h2 className="font-display text-lg font-medium">{title}</h2>
      {description && (
        <p className="mt-1 text-xs leading-relaxed text-ink-700">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="px-4 py-14 text-center">
      <p className="text-sm font-medium text-ink-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-700/55">{hint}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Status                                                                      */
/* -------------------------------------------------------------------------- */

const TONES = {
  neutral: 'bg-ink-900/[0.04] text-ink-700 ring-ink-900/10',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  accent: 'bg-amber-accent/10 text-amber-accent ring-amber-accent/25',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
} as const;

export type Tone = keyof typeof TONES;

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const STATUS_DOT: Record<string, string> = {
  live: 'bg-emerald-500',
  claimed: 'bg-amber-accent',
  paused: 'bg-yellow-500',
  draft: 'bg-ink-900/25',
  cancelled: 'bg-red-500',
};

/**
 * Status as a dot + word rather than a pill. At 50 rows a column of filled
 * pills is a wall of color that drowns out everything else on the page; the
 * dot carries the same signal at a fraction of the visual weight.
 */
export function StatusDot({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-ink-700">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[status] ?? 'bg-ink-900/25'}`} />
      <span className="capitalize">{status}</span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Controls — exported as class strings so both server and client components   */
/* can apply them to plain elements without a wrapper component.               */
/* -------------------------------------------------------------------------- */

const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-accent/40';

export const btn = {
  primary: `${BTN_BASE} bg-ink-900 px-3.5 py-2 text-cream-50 hover:bg-ink-800`,
  secondary: `${BTN_BASE} bg-white px-3.5 py-2 text-ink-900 ring-1 ring-inset ring-ink-900/12 hover:bg-cream-100`,
  ghost: `${BTN_BASE} px-3 py-2 text-ink-700 hover:bg-ink-900/5 hover:text-ink-900`,
  danger: `${BTN_BASE} bg-red-600 px-3.5 py-2 text-white hover:bg-red-700`,
  /** Compact variants for dense rows/toolbars. */
  secondarySm: `${BTN_BASE} bg-white px-2.5 py-1.5 text-xs text-ink-900 ring-1 ring-inset ring-ink-900/12 hover:bg-cream-100`,
  ghostSm: `${BTN_BASE} px-2 py-1.5 text-xs text-ink-700 hover:bg-ink-900/5 hover:text-ink-900`,
};

export const field =
  'rounded-lg border border-ink-900/12 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition-colors focus:border-amber-accent focus:ring-2 focus:ring-amber-accent/15';

/* -------------------------------------------------------------------------- */
/* Table                                                                       */
/* -------------------------------------------------------------------------- */

export const thClass =
  'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-700/55 whitespace-nowrap';
export const tdClass = 'px-4 py-2.5 align-middle';

/** Column header that links to a re-sorted view of the same list. */
export function SortableTh({
  label,
  href,
  active,
  dir,
  className = '',
}: {
  label: string;
  href: string;
  active: boolean;
  dir: 'asc' | 'desc';
  className?: string;
}) {
  return (
    <th scope="col" className={`${thClass} ${className}`}>
      <Link
        href={href}
        className={`inline-flex items-center gap-1 transition-colors hover:text-ink-900 ${
          active ? 'text-ink-900' : ''
        }`}
      >
        {label}
        <span aria-hidden className={active ? 'opacity-100' : 'opacity-0'}>
          {dir === 'asc' ? '↑' : '↓'}
        </span>
      </Link>
    </th>
  );
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

/** "Aug 10" for the current year, "Aug 10, 2025" otherwise. Server-rendered. */
export function formatDate(value: string | Date, currentYear = new Date().getFullYear()): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() === currentYear ? {} : { year: 'numeric' }),
  });
}
