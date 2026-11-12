'use client';

import Link from 'next/link';
import { btn, field } from './ui';

/**
 * Filter toolbar for the clients list.
 *
 * Client-side only so the selects can auto-submit on change — previously every
 * filter change needed a separate click on a "Filter" button. Sort state rides
 * along as hidden inputs so filtering doesn't silently reset the column order;
 * `page` is deliberately *not* carried, so a new filter lands on page 1.
 */
export function ClientsFilters({
  values,
  activeCount,
}: {
  values: { q?: string; status?: string; plan?: string; sort?: string; dir?: string };
  activeCount: number;
}) {
  return (
    <form
      method="get"
      action="/admin"
      onChange={(e) => {
        // Text input changes on every keystroke; only re-run on select changes.
        if ((e.target as HTMLElement).tagName === 'SELECT') e.currentTarget.requestSubmit();
      }}
      className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-ink-900/10 bg-white p-2.5 shadow-[0_1px_2px_rgba(10,10,10,0.04)]"
    >
      {values.sort && <input type="hidden" name="sort" value={values.sort} />}
      {values.dir && <input type="hidden" name="dir" value={values.dir} />}

      <div className="relative min-w-[200px] flex-1">
        <svg
          viewBox="0 0 20 20"
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-700/40"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
        >
          <circle cx="9" cy="9" r="5" />
          <path d="m13 13 4 4" />
        </svg>
        <input
          name="q"
          type="search"
          defaultValue={values.q ?? ''}
          placeholder="Search business name…"
          className={`${field} w-full pl-8`}
        />
      </div>

      <Select name="status" value={values.status} placeholder="All status">
        {['draft', 'live', 'claimed', 'paused', 'cancelled']}
      </Select>
      <Select name="plan" value={values.plan} placeholder="All plans">
        {['starter', 'pro', 'pro_plus']}
      </Select>

      <button type="submit" className={btn.primary}>
        Search
      </button>

      {activeCount > 0 && (
        <Link href="/admin" className={btn.ghost}>
          Clear{' '}
          <span className="rounded-full bg-ink-900/8 px-1.5 text-xs tabular-nums">{activeCount}</span>
        </Link>
      )}
    </form>
  );
}

function Select({
  name,
  value,
  placeholder,
  children,
}: {
  name: string;
  value?: string;
  placeholder: string;
  children: string[];
}) {
  return (
    <select
      name={name}
      defaultValue={value ?? ''}
      aria-label={placeholder}
      className={`${field} max-w-[150px] capitalize ${value ? 'border-amber-accent/40 text-amber-accent' : ''}`}
    >
      <option value="">{placeholder}</option>
      {children.map((v) => (
        <option key={v} value={v}>
          {v.replace(/_/g, ' ')}
        </option>
      ))}
    </select>
  );
}
