import { notFound } from 'next/navigation';
import { getClientByIdAsAdmin } from '@/lib/tenant';
import { getPostForClient } from '@/lib/blog/posts';
import { clientSubdomainHost } from '@/lib/marketing-brand';
import { PostEditor } from './PostEditor';

export const dynamic = 'force-dynamic';

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string; postId: string }>;
}) {
  const { id, postId } = await params;

  const client = await getClientByIdAsAdmin(id).catch(() => null);
  if (!client) notFound();

  const post = await getPostForClient(id, postId);
  if (!post) notFound();

  const publicBase = client.custom_domain
    ? `https://${client.custom_domain}`
    : `https://${clientSubdomainHost(client)}`;

  return <PostEditor clientId={id} post={post} publicBase={publicBase} />;
}
