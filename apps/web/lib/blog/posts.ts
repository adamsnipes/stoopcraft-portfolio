import { createServiceRoleClient } from '@/lib/supabase/server';
import { clientSubdomainHost } from '@/lib/marketing-brand';
import type { PostRow, PostInsert, PostUpdate } from '@dfy/db';

// ============================================================================
// Tenant-isolated data access for blog posts.
//
// EVERY function takes a `clientId` and scopes its query to it — there is no
// code path that reads or writes a post without naming the owning client. The
// `posts` table is RLS deny-by-default, so these service-role queries are the
// only way in, and they are always client-scoped. Result: one client's posts
// can never appear in another client's blog or admin view, and a post id from
// one tenant can't be mutated under another (the client_id predicate makes the
// row simply not match).
// ============================================================================

/**
 * The public hostname a client's site is served at — custom domain if attached,
 * otherwise the platform subdomain. Used by the sanitizer to tell an author's
 * absolute self-link apart from a genuinely external one (lib/blog/sanitize.ts).
 */
export async function getClientSiteHost(clientId: string): Promise<string | undefined> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from('clients')
    .select('slug, custom_domain, brand')
    .eq('id', clientId)
    .maybeSingle();
  if (!data) return undefined;
  if (data.custom_domain) return data.custom_domain;
  return clientSubdomainHost(data);
}

/** Published posts for a client's public blog index, newest first. */
export async function listPublishedPosts(clientId: string): Promise<PostRow[]> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from('posts')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  return data ?? [];
}

/** A single published post by slug, scoped to the client. Null if not found. */
export async function getPublishedPost(clientId: string, slug: string): Promise<PostRow | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from('posts')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'published')
    .eq('slug', slug)
    .maybeSingle();
  return data ?? null;
}

/** All posts (any status) for a client — the admin editor's list. */
export async function listPostsForClient(clientId: string): Promise<PostRow[]> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from('posts')
    .select('*')
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false });
  return data ?? [];
}

/** A single post by id, scoped to the client (admin edit). Null if not theirs. */
export async function getPostForClient(clientId: string, postId: string): Promise<PostRow | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from('posts')
    .select('*')
    .eq('client_id', clientId)
    .eq('id', postId)
    .maybeSingle();
  return data ?? null;
}

/** Create a post for a client. clientId is forced onto the row by the caller. */
export async function createPost(
  clientId: string,
  fields: Omit<PostInsert, 'client_id' | 'id'>,
): Promise<PostRow | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from('posts')
    .insert({ ...fields, client_id: clientId })
    .select('*')
    .single();
  return data ?? null;
}

/** Update a post, scoped to the client so a foreign id can never be touched. */
export async function updatePost(
  clientId: string,
  postId: string,
  fields: Omit<PostUpdate, 'client_id' | 'id'>,
): Promise<PostRow | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from('posts')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('id', postId)
    .select('*')
    .maybeSingle();
  return data ?? null;
}

/** Delete a post, scoped to the client. */
export async function deletePost(clientId: string, postId: string): Promise<void> {
  const admin = createServiceRoleClient();
  await admin.from('posts').delete().eq('client_id', clientId).eq('id', postId);
}

/**
 * A slug unique within this client (the DB enforces unique(client_id, slug)).
 * Appends -2, -3, … on collision. excludeId lets a post keep its own slug on
 * update. Scoped by clientId, so collisions are only ever checked within tenant.
 */
export async function ensureUniqueSlug(
  clientId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  const admin = createServiceRoleClient();
  for (let n = 1; n <= 100; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const { data } = await admin
      .from('posts')
      .select('id')
      .eq('client_id', clientId)
      .eq('slug', slug)
      .maybeSingle();
    if (!data || data.id === excludeId) return slug;
  }
  // Extremely unlikely fallback — keep it unique without another round-trip.
  return `${base}-${Date.now()}`;
}
