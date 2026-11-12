import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { AdminNavRail, AdminNavBar } from './AdminNav';

export const metadata: Metadata = {
  title: { default: 'Stoopcraft Admin', template: '%s — Stoopcraft Admin' },
};

// Nav items live in ./AdminNav so the rail and the mobile bar can't drift.
// Generate / Reps / Payouts / Settings routes still exist but are unlisted —
// add them to ADMIN_NAV to bring the tabs back.

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  if (headersList.get('x-pathname') === '/admin/login') {
    return <>{children}</>;
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect('/admin/login');
  }

  return (
    <div className="min-h-screen bg-cream-50 text-ink-900 font-sans lg:flex">
      {/* Desktop rail. Dark surface so the content column reads as the page and
          the chrome recedes — the previous all-white header made every white
          card compete with the nav for attention. */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-ink-900 text-cream-50 lg:flex">
        <Link
          href="/admin"
          className="flex items-center gap-2 px-6 py-5 font-display text-[15px] tracking-tight"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-amber-accent-soft" />
          <span className="font-semibold">Stoopcraft</span>
          <span className="font-normal text-cream-200/50">Admin</span>
        </Link>

        <AdminNavRail />

        <div className="mt-auto border-t border-white/10 px-6 py-4">
          <div className="truncate text-xs text-cream-200/50" title={user.email}>
            {user.email}
          </div>
        </div>
      </aside>

      {/* Mobile / tablet header */}
      <header className="sticky top-0 z-30 border-b border-ink-900/10 bg-cream-50/85 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/admin" className="flex shrink-0 items-center gap-2 font-display tracking-tight">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-accent" />
            <span className="font-semibold">Stoopcraft</span>
          </Link>
          <AdminNavBar />
        </div>
      </header>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
