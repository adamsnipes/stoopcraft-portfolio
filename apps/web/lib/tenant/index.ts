import { cache } from 'react';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { CHEAP_BRAND, cheapPreviewSlug } from '@/lib/marketing-brand';
import type {
  ClientRow,
  ContentRow,
  PhotoRow,
  SectionConfig,
  ServiceItem,
  ThemeConfig,
  HoursConfig,
  MenuConfig,
  OrderingLink,
  SocialLink,
} from '@dfy/db';

// ============================================================================
// Public-safe client subset — only fields safe to expose to anonymous visitors
// ============================================================================
export type PublicClient = Pick<
  ClientRow,
  | 'id'
  | 'slug'
  | 'business_name'
  | 'phone'
  | 'address'
  | 'city'
  | 'state'
  | 'lat'
  | 'lng'
  | 'custom_domain'
  | 'owner_user_id'
  | 'favicon_url'
  | 'logo_url'
  | 'google_place_id'
  | 'business_vertical'
  | 'hide_claim_banner'
  | 'brand'
> & {
  status: 'live' | 'claimed';
};

// ============================================================================
// Context shapes
// ============================================================================
export type PublicClientContext = {
  type: 'public';
  client: PublicClient;
  content: ContentRow;
  photos: PhotoRow[];
  // Menu-item photos (purpose='menu_item') referenced by MenuItem.photo_id.
  // Kept separate from `photos` so Hero/About/Gallery don't accidentally pull
  // menu shots when reading photos[0]/photos[1].
  menuPhotos: PhotoRow[];
};

export type AuthenticatedClientContext = {
  type: 'authenticated';
  userId: string;
  client: ClientRow;
  // null for static (uploaded) sites — they have no content row. Template
  // sites always have one. Only restaurant menu features read this.
  content: ContentRow | null;
  photos: PhotoRow[];
  menuPhotos: PhotoRow[];
};

// ============================================================================
// Typed JSONB helpers — parse DB Json columns at the app boundary
// ============================================================================
export function parseSections(raw: unknown): SectionConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is SectionConfig =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as Record<string, unknown>)['type'] === 'string' &&
      typeof (s as Record<string, unknown>)['enabled'] === 'boolean' &&
      typeof (s as Record<string, unknown>)['variant'] === 'string'
  );
}

export function parseServices(raw: unknown): ServiceItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is ServiceItem =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as Record<string, unknown>)['name'] === 'string'
  );
}

export function parseMenu(raw: unknown): MenuConfig {
  if (typeof raw !== 'object' || raw === null) return { categories: [] };
  const root = raw as Record<string, unknown>;
  const categories = root['categories'];
  if (!Array.isArray(categories)) return { categories: [] };
  const validated = categories
    .filter(
      (c): c is Record<string, unknown> =>
        typeof c === 'object' &&
        c !== null &&
        typeof (c as Record<string, unknown>)['id'] === 'string' &&
        typeof (c as Record<string, unknown>)['title'] === 'string' &&
        Array.isArray((c as Record<string, unknown>)['items']),
    )
    .map((c) => ({
      id: c['id'] as string,
      title: c['title'] as string,
      description: typeof c['description'] === 'string' ? (c['description'] as string) : undefined,
      external_id: typeof c['external_id'] === 'string' ? (c['external_id'] as string) : undefined,
      items: (c['items'] as unknown[])
        .filter(
          (i): i is Record<string, unknown> =>
            typeof i === 'object' &&
            i !== null &&
            typeof (i as Record<string, unknown>)['id'] === 'string' &&
            typeof (i as Record<string, unknown>)['name'] === 'string',
        )
        .map((i) => ({
          id: i['id'] as string,
          name: i['name'] as string,
          description: typeof i['description'] === 'string' ? (i['description'] as string) : '',
          price: typeof i['price'] === 'string' ? (i['price'] as string) : '',
          dietary: Array.isArray(i['dietary'])
            ? (i['dietary'] as unknown[]).filter((d): d is string => typeof d === 'string')
            : undefined,
          photo_id: typeof i['photo_id'] === 'string' ? (i['photo_id'] as string) : undefined,
          photo_url: typeof i['photo_url'] === 'string' ? (i['photo_url'] as string) : undefined,
          external_id: typeof i['external_id'] === 'string' ? (i['external_id'] as string) : undefined,
          is_synced: typeof i['is_synced'] === 'boolean' ? (i['is_synced'] as boolean) : undefined,
        })),
    }));
  return {
    categories: validated as MenuConfig['categories'],
    show_images: typeof root['show_images'] === 'boolean' ? (root['show_images'] as boolean) : undefined,
  };
}

const SOCIAL_PLATFORMS = new Set<SocialLink['platform']>([
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'twitter',
  'linkedin',
]);

export function parseSocialLinks(raw: unknown): SocialLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (l): l is Record<string, unknown> =>
        typeof l === 'object' &&
        l !== null &&
        typeof (l as Record<string, unknown>)['platform'] === 'string' &&
        typeof (l as Record<string, unknown>)['url'] === 'string' &&
        SOCIAL_PLATFORMS.has(
          (l as Record<string, unknown>)['platform'] as SocialLink['platform'],
        ),
    )
    .map((l) => ({
      platform: l['platform'] as SocialLink['platform'],
      url: l['url'] as string,
    }));
}

export function parseOrderingLinks(raw: unknown): OrderingLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (l): l is Record<string, unknown> =>
        typeof l === 'object' &&
        l !== null &&
        typeof (l as Record<string, unknown>)['platform'] === 'string' &&
        typeof (l as Record<string, unknown>)['url'] === 'string',
    )
    .map((l) => ({
      platform: l['platform'] as OrderingLink['platform'],
      url: l['url'] as string,
      label: typeof l['label'] === 'string' ? (l['label'] as string) : undefined,
    }));
}

const VALID_STYLES = new Set([
  'editorial',
  'luxe',
  'premium-dark',
  'bold',
  'minimal',
  'service-tech',
  'flagship-atelier',
  'restaurant-trattoria',
  'restaurant-modern',
  'restaurant-cafe',
  'restaurant-omakase',
  'restaurant-counter',
  'trades-classic',
  'trades-bold',
  'playful-pop',
  'brutalist',
  'art-deco',
  'retro-90s',
]);

// Whether a theme's background is dark enough that cards/surfaces need the
// "on-dark" treatment (subtle light tint instead of solid white). Used at SSR
// time in <Site /> to set --card-surface, and at runtime in PreviewBridge so
// admin palette switches update the cards live without an iframe reload.
// Branching on style alone isn't enough — service-tech "Navy / Electric" is a
// dark palette under a non-premium-dark style, and used to render white cards
// with white text.
export function isDarkBackground(hex: string): boolean {
  const cleaned = hex.replace('#', '');
  const expanded =
    cleaned.length === 3
      ? cleaned.split('').map((c) => c + c).join('')
      : cleaned.length >= 6
        ? cleaned.slice(0, 6)
        : '';
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return false;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

const VALID_TREATMENTS = new Set(['mesh', 'blobs', 'dotgrid', 'grain']);

export function parseTheme(raw: unknown): ThemeConfig {
  const defaults: ThemeConfig = {
    primary: '#1a1a1a',
    background: '#ffffff',
    text: '#1a1a1a',
    accent: '#d4a373',
    fontHeading: 'Playfair Display',
    fontBody: 'Inter',
    borderRadius: '0.5rem',
    style: 'editorial',
  };
  if (typeof raw !== 'object' || raw === null) return defaults;
  const t = raw as Record<string, unknown>;
  const rawStyle = typeof t['style'] === 'string' ? t['style'] : '';
  const rawTreatment = typeof t['background_treatment'] === 'string' ? t['background_treatment'] : '';
  const rawAlt = typeof t['background_alt'] === 'string' ? t['background_alt'] : '';
  return {
    primary: typeof t['primary'] === 'string' ? t['primary'] : defaults.primary,
    background: typeof t['background'] === 'string' ? t['background'] : defaults.background,
    text: typeof t['text'] === 'string' ? t['text'] : defaults.text,
    accent: typeof t['accent'] === 'string' ? t['accent'] : defaults.accent,
    fontHeading: typeof t['fontHeading'] === 'string' ? t['fontHeading'] : defaults.fontHeading,
    fontBody: typeof t['fontBody'] === 'string' ? t['fontBody'] : defaults.fontBody,
    borderRadius: typeof t['borderRadius'] === 'string' ? t['borderRadius'] : defaults.borderRadius,
    style: VALID_STYLES.has(rawStyle) ? (rawStyle as ThemeConfig['style']) : defaults.style,
    ...(VALID_TREATMENTS.has(rawTreatment)
      ? { background_treatment: rawTreatment as ThemeConfig['background_treatment'] }
      : {}),
    ...(rawAlt ? { background_alt: rawAlt } : {}),
    ...(typeof t['alt_bg_enabled'] === 'boolean'
      ? { alt_bg_enabled: t['alt_bg_enabled'] as boolean }
      : {}),
  };
}

export function parseHours(raw: unknown): HoursConfig {
  if (typeof raw !== 'object' || raw === null) return {};
  return raw as HoursConfig;
}

// ============================================================================
// Path 1: Claimed clients — anon key, RLS enforces access
// ============================================================================

/**
 * Resolve a claimed client by host for public rendering.
 * Uses the anon Supabase client — RLS ensures only claimed, uncancelled,
 * owned clients are returned. Returns null for pre-sale, draft, cancelled, 404.
 */
export const getClaimedClientByHost = cache(
  async (host: string): Promise<PublicClientContext | null> => {
    const supabase = await createServerClient();
    const platformDomain = process.env.PLATFORM_DOMAIN!;

    // A brand subdomain only ever resolves that brand's clients.
    const brandSlug = cheapPreviewSlug(host);
    const isSubdomain = host.endsWith('.' + platformDomain);
    const slug = brandSlug ?? (isSubdomain ? host.replace('.' + platformDomain, '') : null);

    const allClients = supabase
      .from('clients')
      .select('*, content!inner(*), photos(*)');
    const baseQuery = brandSlug ? allClients.eq('brand', CHEAP_BRAND.id) : allClients;

    const { data, error } = await (
      slug
        ? baseQuery.eq('slug', slug).eq('content.is_published', true)
        : baseQuery.eq('custom_domain', host).eq('content.is_published', true)
    ).single();

    if (error || !data) return null;

    // Defense in depth: RLS already filtered, but double-check
    if (data.status !== 'claimed') return null;
    if (data.cancelled_at) return null;
    if (!data.owner_user_id) return null;

    const contentRows = data.content as ContentRow[];
    // Split by purpose: Gallery / Hero / About read `photos`, Menu reads
    // `menuPhotos`. Mixing them risked hero/about pulling a menu shot via
    // photos[0] when sorted by position.
    const allPhotos = data.photos as PhotoRow[];
    const photoRows = allPhotos.filter((p) => p.purpose === 'gallery');
    const menuPhotoRows = allPhotos.filter((p) => p.purpose === 'menu_item');
    const publishedContent = contentRows.find((c) => c.is_published) ?? contentRows[0];
    if (!publishedContent) return null;

    return {
      type: 'public',
      client: {
        id: data.id,
        slug: data.slug,
        status: 'claimed',
        business_name: data.business_name,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        lat: data.lat,
        lng: data.lng,
        custom_domain: data.custom_domain,
        owner_user_id: data.owner_user_id,
        favicon_url: data.favicon_url ?? null,
        logo_url: data.logo_url ?? null,
        google_place_id: data.google_place_id,
        business_vertical: data.business_vertical,
        hide_claim_banner: data.hide_claim_banner ?? false,
        brand: data.brand ?? 'stoopcraft',
      },
      content: publishedContent,
      photos: [...photoRows].sort((a, b) => a.position - b.position),
      menuPhotos: [...menuPhotoRows].sort((a, b) => a.position - b.position),
    };
  }
);

// ============================================================================
// Path 2: Token-validated access — service role, token gates access
// ============================================================================

/**
 * Resolve a client by host AND claim token. Service role (bypasses RLS) gated
 * by token match. Serves two scenarios:
 *   1. Pre-sale (status='live'): the customer hasn't claimed yet, the token
 *      is the only way to view the site at all.
 *   2. Admin editor preview (status='claimed'): Path 1 fails for the admin
 *      because their authenticated session isn't the owner_user_id, so RLS
 *      hides the row. The token — still in the DB after claim — lets the
 *      editor iframe render the live site so admins can see edits.
 *
 * Cancelled clients are always rejected.
 */
export async function getClientByHostAndToken(
  host: string,
  token: string
): Promise<PublicClientContext | null> {
  if (!token || token.length < 10) return null;

  const supabase = createServiceRoleClient();
  const platformDomain = process.env.PLATFORM_DOMAIN!;

  // A brand subdomain only ever resolves that brand's clients.
  const brandSlug = cheapPreviewSlug(host);
  const isSubdomain = host.endsWith('.' + platformDomain);
  const slug = brandSlug ?? (isSubdomain ? host.replace('.' + platformDomain, '') : null);

  const allClients = supabase
    .from('clients')
    .select('*, content!inner(*), photos(*)');
  const baseQuery = brandSlug ? allClients.eq('brand', CHEAP_BRAND.id) : allClients;

  const { data, error } = await (
    slug
      ? baseQuery.eq('slug', slug).eq('content.is_published', true)
      : baseQuery.eq('custom_domain', host).eq('content.is_published', true)
  ).single();

  if (error || !data) return null;

  // Token must match — this is the only gate
  if (data.claim_token !== token) return null;

  if (data.status !== 'live' && data.status !== 'claimed') return null;
  if (data.cancelled_at) return null;

  const contentRows = data.content as ContentRow[];
  // Same split as getClaimedClientByHost.
  const allPhotos = data.photos as PhotoRow[];
  const photoRows = allPhotos.filter((p) => p.purpose === 'gallery');
  const menuPhotoRows = allPhotos.filter((p) => p.purpose === 'menu_item');
  const publishedContent = contentRows.find((c) => c.is_published) ?? contentRows[0];
  if (!publishedContent) return null;

  return {
    type: 'public',
    client: {
      id: data.id,
      slug: data.slug,
      status: data.status === 'claimed' ? 'claimed' : 'live',
      business_name: data.business_name,
      phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state,
      lat: data.lat,
      lng: data.lng,
      custom_domain: data.custom_domain,
      owner_user_id: data.owner_user_id,
      favicon_url: data.favicon_url ?? null,
      logo_url: data.logo_url ?? null,
      google_place_id: data.google_place_id,
      business_vertical: data.business_vertical,
      hide_claim_banner: data.hide_claim_banner ?? false,
      brand: data.brand ?? 'stoopcraft',
    },
    content: publishedContent,
    photos: [...photoRows].sort((a, b) => a.position - b.position),
    menuPhotos: [...menuPhotoRows].sort((a, b) => a.position - b.position),
  };
}

// ============================================================================
// Authenticated customer context — never takes clientId from request
// ============================================================================

/**
 * Resolve the authenticated user's client.
 * Always derives client from session user ID — never from request body or URL.
 */
export async function getAuthenticatedClient(): Promise<AuthenticatedClientContext | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const adminSupabase = createServiceRoleClient();
  // NOT .single(): a signed-in user can legitimately own zero clients (their
  // site was unclaimed, or they signed in with a different email than they
  // purchased under) — that's not an error, it's a "no site linked" state the
  // portal explains rather than looping on /login. And a re-claim can leave a
  // user owning >1 row; .single() throws on both. Order so the most recently
  // claimed (then most recent) wins, and take the first.
  const { data: rows, error } = await adminSupabase
    .from('clients')
    .select('*, content(*), photos(*)')
    .eq('owner_user_id', user.id)
    .order('claimed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  const data = rows?.[0];
  if (error || !data) return null;

  const contentRows = data.content as ContentRow[];
  const allPhotos = data.photos as PhotoRow[];
  const photoRows = allPhotos.filter((p) => p.purpose === 'gallery');
  const menuPhotoRows = allPhotos.filter((p) => p.purpose === 'menu_item');
  const activeContent =
    contentRows.find((c) => c.is_published) ?? contentRows[0] ?? null;
  // Static (uploaded) sites have no content row — that's expected, let them
  // into the portal. A template site missing content is a real error.
  if (!activeContent && data.render_mode !== 'static') return null;

  return {
    type: 'authenticated',
    userId: user.id,
    client: data,
    content: activeContent,
    photos: photoRows,
    menuPhotos: menuPhotoRows,
  };
}

// ============================================================================
// Admin context — caller must be ADMIN_EMAIL
// ============================================================================

/**
 * Fetch any client by ID. Throws UNAUTHORIZED if caller is not admin.
 * Always check admin identity server-side; do not rely on middleware alone.
 */
export async function getClientByIdAsAdmin(clientId: string): Promise<ClientRow> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    throw new Error('UNAUTHORIZED');
  }

  const adminSupabase = createServiceRoleClient();
  const { data, error } = await adminSupabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (error || !data) throw new Error('NOT_FOUND');
  return data;
}
