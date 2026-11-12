import { notFound } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { parseMenu } from '@/lib/tenant';
import { MenuEditor } from '@/components/menu-editor/MenuEditor';
import { Panel } from '../../../ui';

type Params = Promise<{ id: string }>;

export default async function MenuEditorPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, business_vertical')
    .eq('id', id)
    .single();
  if (!client) notFound();

  // Salon clients have no menu — guard so a misclick doesn't accidentally
  // persist menu data on a row that no template renders.
  if (client.business_vertical !== 'restaurant') {
    return (
      // Reachable only by typing the URL — the Menu tab is hidden for
      // non-restaurant clients.
      <Panel title="No menu for this client">
        <p className="text-sm text-ink-700/80">
          This client isn&apos;t a restaurant (
          {client.business_vertical ?? 'beauty / appointment-based'}), so it doesn&apos;t have a
          menu. Menus are only used for clients with{' '}
          <code className="rounded bg-ink-900/5 px-1">business_vertical = &apos;restaurant&apos;</code>
          .
        </p>
      </Panel>
    );
  }

  const { data: content } = await supabase
    .from('content')
    .select('menu')
    .eq('client_id', id)
    .eq('is_published', true)
    .single();
  if (!content) notFound();

  const menu = parseMenu(content.menu);

  return (
    <div>
      <p className="mb-5 text-sm text-ink-700/70">
        Edit categories and items. Reorder with the up/down arrows. Saved changes publish to the
        live site immediately.
      </p>

      <MenuEditor
        initialMenu={menu}
        saveEndpoint={`/api/admin/clients/${id}/menu`}
      />
    </div>
  );
}
