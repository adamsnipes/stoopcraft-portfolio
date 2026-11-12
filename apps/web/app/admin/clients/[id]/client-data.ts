import { cache } from 'react';
import { getClientByIdAsAdmin } from '@/lib/tenant';

/**
 * The client row for the admin detail screens.
 *
 * Wrapped in React `cache()` so the layout (which needs the header, the tab
 * list and the render_mode gate) and the page rendered inside it share a single
 * round trip instead of each issuing its own `select('*')`.
 *
 * Returns null rather than throwing so callers can `notFound()`.
 */
export const getClient = cache(async (id: string) =>
  getClientByIdAsAdmin(id).catch(() => null),
);

export type AdminClient = NonNullable<Awaited<ReturnType<typeof getClient>>>;

export type ClientTab = {
  label: string;
  href: string;
  /** Renders in red and sits last — destructive-only surfaces. */
  danger?: boolean;
};

/**
 * The tab strip is derived, not hand-maintained per page. Static (uploaded
 * HTML) clients have no template content/photos to edit; template clients have
 * no uploaded bundle. Menu only exists for the restaurant vertical — that route
 * previously had no link into it at all.
 */
export function tabsForClient(client: AdminClient): ClientTab[] {
  const base = `/admin/clients/${client.id}`;
  const isStatic = client.render_mode === 'static';

  return [
    { label: 'Setup', href: base },
    ...(isStatic
      ? [{ label: 'Blog', href: `${base}/blog` }]
      : [
          { label: 'Content', href: `${base}/content` },
          { label: 'Photos', href: `${base}/photos` },
          ...(client.business_vertical === 'restaurant'
            ? [{ label: 'Menu', href: `${base}/menu` }]
            : []),
        ]),
    { label: 'Notifications', href: `${base}/notifications` },
    { label: 'Billing', href: `${base}/billing` },
    { label: 'Search Report', href: `${base}/seo` },
    { label: 'Advanced', href: `${base}/advanced` },
    { label: 'Danger Zone', href: `${base}/danger`, danger: true },
  ];
}
