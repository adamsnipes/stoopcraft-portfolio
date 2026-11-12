'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Admin navigation. Single source of truth for the nav items, rendered as a
 * dark rail on desktop and a scrolling pill bar on mobile.
 *
 * `match` exists because the active item isn't always an exact path match:
 * /admin/clients/<id> has to light up "Clients", whose href is bare /admin.
 */
type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
  icon: React.ReactNode;
};

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px] shrink-0" aria-hidden {...stroke}>
      {children}
    </svg>
  );
}

export const ADMIN_NAV: NavItem[] = [
  {
    href: '/admin',
    label: 'Clients',
    match: (p) => p === '/admin' || p.startsWith('/admin/clients'),
    icon: (
      <Icon>
        <path d="M3 16.5V6.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v10" />
        <path d="M10 16.5v-7a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v7" />
        <path d="M2 16.5h16M5.5 8.5h2M5.5 11.5h2M12.5 11.5h2" />
      </Icon>
    ),
  },
  {
    href: '/admin/static-sites',
    label: 'HTML Sites',
    match: (p) => p.startsWith('/admin/static-sites'),
    icon: (
      <Icon>
        <path d="M7 7.5 4 10l3 2.5M13 7.5 16 10l-3 2.5M11.5 5.5l-3 9" />
      </Icon>
    ),
  },
  {
    href: '/admin/scrape-leads',
    label: 'Scrape Leads',
    match: (p) => p.startsWith('/admin/scrape-leads'),
    icon: (
      <Icon>
        <circle cx="9" cy="9" r="5" />
        <path d="m13 13 4 4" />
      </Icon>
    ),
  },
  {
    href: '/admin/requests',
    label: 'Requests',
    match: (p) => p.startsWith('/admin/requests'),
    icon: (
      <Icon>
        <path d="M3 11.5h4l1 2h4l1-2h4" />
        <path d="M4.5 4.5h11l1.5 7v4a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-4z" />
      </Icon>
    ),
  },
  {
    href: '/admin/sop',
    label: 'SOP',
    match: (p) => p.startsWith('/admin/sop'),
    icon: (
      <Icon>
        <path d="M5.5 3.5h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z" />
        <path d="m7.5 8 1.2 1.2L11.5 6.5M7.5 12.5h5" />
      </Icon>
    ),
  },
  {
    href: '/admin/emails',
    label: 'Emails',
    match: (p) => p.startsWith('/admin/emails'),
    icon: (
      <Icon>
        <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
        <path d="m3 6 7 4.5L17 6" />
      </Icon>
    ),
  },
];

/** Vertical rail — dark sidebar, desktop only. */
export function AdminNavRail() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {ADMIN_NAV.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-white/10 font-medium text-white'
                : 'text-cream-200/65 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            <span className={active ? 'text-amber-accent-soft' : ''}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Horizontal pill bar — mobile/tablet header, scrolls sideways if needed. */
export function AdminNavBar() {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ADMIN_NAV.map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
              active
                ? 'bg-ink-900 font-medium text-cream-50'
                : 'text-ink-700 hover:bg-ink-900/5 hover:text-ink-900'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
