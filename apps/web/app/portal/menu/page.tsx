import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedClient, parseMenu } from '@/lib/tenant';
import { MenuEditor } from '@/components/menu-editor/MenuEditor';

export const metadata: Metadata = { title: 'Menu' };

export default async function PortalMenuPage() {
  const ctx = await getAuthenticatedClient();
  if (!ctx) redirect('/login');

  // Salon customers shouldn't be here. The nav doesn't link to /portal/menu
  // for them, but a typed URL or stale bookmark could land them anyway.
  if (ctx.client.business_vertical !== 'restaurant') {
    return (
      <div className="max-w-2xl mx-auto py-12 px-6 text-center">
        <h1 className="text-2xl font-bold mb-3">Menu editing isn&apos;t available</h1>
        <p className="text-sm text-ink-700 mb-6">
          Menu editing is only available for restaurant accounts. If you think this is wrong,
          please reach out via the Request Change page.
        </p>
        <Link href="/portal" className="text-sm text-blue-600 hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  // Restaurants are template sites and always have a content row; guard anyway
  // so the type is non-null (static sites have no content but never reach here).
  if (!ctx.content) redirect('/portal');

  const menu = parseMenu(ctx.content.menu);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Menu</h1>
        <p className="text-sm text-ink-700/70 mt-1">
          Edit categories and items. Reorder with the up/down arrows. Saved changes
          publish to your live site immediately — no review needed.
        </p>
      </div>

      <MenuEditor initialMenu={menu} saveEndpoint="/api/portal/menu" />
    </div>
  );
}
