'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ClientTab } from './client-data';

/**
 * Tab strip for a single client. Every tab is a real route, so tabs are
 * linkable, back/forward works, and each page only queries what it renders.
 *
 * Active matching is exact for the Setup tab (its href is the bare client URL,
 * a prefix of every other tab) and prefix-based elsewhere so nested routes like
 * /blog/<postId> keep their parent tab lit.
 */
export function ClientTabs({ tabs, baseHref }: { tabs: ClientTab[]; baseHref: string }) {
  const pathname = usePathname();

  return (
    <div className="-mx-4 mb-6 overflow-x-auto border-b border-ink-900/10 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const active =
            tab.href === baseHref ? pathname === baseHref : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                active
                  ? tab.danger
                    ? 'border-red-500 font-medium text-red-700'
                    : 'border-ink-900 font-medium text-ink-900'
                  : tab.danger
                    ? 'border-transparent text-red-600/70 hover:text-red-700'
                    : 'border-transparent text-ink-700/70 hover:border-ink-900/20 hover:text-ink-900'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
