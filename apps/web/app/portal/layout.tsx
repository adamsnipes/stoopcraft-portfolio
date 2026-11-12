import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthenticatedClient } from '@/lib/tenant';
import { createServerClient } from '@/lib/supabase/server';
import Link from 'next/link';

export const metadata: Metadata = {
  title: { default: "My Portal", template: "%s — StoopCraft" },
};

const BASE_NAV = [
  { href: '/portal', label: 'Dashboard' },
  { href: '/portal/preview', label: 'Preview' },
  { href: '/portal/request', label: 'Request Change' },
  { href: '/portal/billing', label: 'Billing' },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthenticatedClient();
  if (!ctx) {
    // Two different reasons land here. Tell them apart so an authenticated user
    // whose email simply owns no site gets told *why* — instead of bouncing to
    // a bare /login and requesting link after link that each loop back here.
    // (This is the unclaim / wrong-email case: the magic link works, but the
    // signed-in account owns nothing.)
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) redirect(`/login?nosite=${encodeURIComponent(user.email)}`);
    redirect('/login');
  }

  // Static (uploaded, hand-managed) sites get a stripped-down portal: these
  // clients don't self-serve content, so we hide Preview/Menu and surface only
  // the three things they need — request a change, see invoices, and cancel.
  // Cancel exists for every plan but is otherwise unlinked; here it's explicit.
  // Restaurant customers (template sites) get an extra Menu link — they
  // self-serve menu edits (specials/prices change too often to gate behind
  // staff requests). Salon customers don't see Menu at all.
  const nav = ctx.client.render_mode === 'static'
    ? [
        { href: '/portal/request', label: 'Request Change' },
        { href: '/portal/billing', label: 'Billing' },
        { href: '/portal/cancel', label: 'Cancel' },
      ]
    : ctx.client.business_vertical === 'restaurant'
      ? [BASE_NAV[0]!, { href: '/portal/menu', label: 'Menu' }, ...BASE_NAV.slice(1)]
      : BASE_NAV;

  return (
    <div className="min-h-screen bg-cream-50 text-ink-900 font-sans">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-cream-50/80 border-b border-ink-900/10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-2 font-display text-lg tracking-tight">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-accent" />
            <span className="font-semibold">Stoopcraft</span>
            <span className="text-ink-700/60 font-normal hidden sm:inline">Portal</span>
          </Link>

          <nav className="flex items-center gap-1">
            {nav.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-full text-sm text-ink-700 hover:text-ink-900 hover:bg-ink-900/5 transition-colors"
              >
                {label}
              </Link>
            ))}
            <span className="ml-3 text-xs text-ink-700/60 hidden md:inline">{ctx.client.business_name}</span>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
