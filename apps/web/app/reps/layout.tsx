import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { getAuthenticatedRep } from '@/lib/sales-rep/auth';

export const metadata: Metadata = {
  title: { default: 'Stoopcraft Reps', template: '%s — Stoopcraft Reps' },
};

type NavItem = { href: string; label: string; repsOnly?: boolean };

// Generate + Leads are rep-only tools (active outreach). Affiliates see a
// trimmed nav focused on their link, customers, and commissions. The Guide
// link resolves per-kind below — /sales-reps is the active-outreach
// playbook, /affiliates is the share-link playbook.
const NAV: NavItem[] = [
  { href: '/reps', label: 'Overview' },
  { href: '/reps/generate', label: 'Generate', repsOnly: true },
  { href: '/reps/customers', label: 'Customers' },
  { href: '/reps/leads', label: 'Leads', repsOnly: true },
  { href: '/reps/commissions', label: 'Commissions' },
  { href: '/reps/outreach', label: 'Outreach' },
  // Guide href is filled in at render time; sentinel value here to keep
  // the array shape consistent.
  { href: '__guide__', label: 'Guide' },
  { href: '/reps/settings', label: 'Settings' },
];

export default async function RepsLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? '';

  // The login / pending / disabled pages render bare. Everything else needs
  // an active rep session.
  const isAuthPage = pathname === '/reps/login'
    || pathname === '/reps/pending'
    || pathname === '/reps/disabled';
  if (isAuthPage) return <>{children}</>;

  const ctx = await getAuthenticatedRep();
  if (!ctx) redirect('/reps/login');
  if (ctx.rep.status === 'pending') redirect('/reps/pending');
  if (ctx.rep.status === 'disabled') redirect('/reps/disabled');

  const isAffiliate = ctx.rep.kind === 'affiliate';
  const guideHref = isAffiliate ? '/affiliates' : '/sales-reps';
  const nav = NAV.filter((item) => !(item.repsOnly && isAffiliate)).map((item) =>
    item.href === '__guide__' ? { ...item, href: guideHref } : item,
  );
  const headerLabel = isAffiliate ? 'Affiliate' : 'Reps';

  return (
    <div className="min-h-screen bg-cream-50 text-ink-900 font-sans">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-cream-50/80 border-b border-ink-900/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <Link href="/reps" className="flex items-center gap-2 font-display text-lg tracking-tight shrink-0">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-accent" />
            <span className="font-semibold">Stoopcraft</span>
            <span className="hidden sm:inline text-ink-700/60 font-normal">{headerLabel}</span>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto -mr-2 pr-2 sm:mr-0 sm:pr-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 rounded-full text-sm text-ink-700 hover:text-ink-900 hover:bg-ink-900/5 transition-colors whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
            <span className="hidden md:inline ml-3 text-xs text-ink-700/60">{ctx.rep.name ?? ctx.email}</span>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-[max(env(safe-area-inset-bottom),1.5rem)]">{children}</main>
    </div>
  );
}
