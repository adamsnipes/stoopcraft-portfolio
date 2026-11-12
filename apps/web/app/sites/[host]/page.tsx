import { notFound } from 'next/navigation';
import { getClaimedClientByHost, getClientByHostAndToken, parseSections, parseTheme } from '@/lib/tenant';
import {
  listValidHeroCompositions,
  listValidServicesCompositions,
  listValidGalleryCompositions,
  listValidMenuCompositions,
} from '@/lib/content-gen/compositions';
import { PALETTE_PRESETS } from '@/lib/content-gen/palettes';
import { Site } from '@/components/template/Site';
import type { Metadata } from 'next';
import type { PublicClientContext } from '@/lib/tenant';
import type { ThemeStyle } from '@dfy/db';

export const revalidate = 3600; // 1-hour ISR
export const dynamicParams = true;

type Params = Promise<{ host: string }>;
type SearchParams = Promise<{
  t?: string;
  _preview_hero?: string;
  _preview_services?: string;
  _preview_gallery?: string;
  _preview_menu?: string;
  _preview_style?: string;
  // Restaurant content overrides — same pattern as compositions, but for
  // data fields that change which sections render (or how a section renders
  // its data). JSON-encoded payload for ordering_links since it's a list.
  _preview_ordering_links?: string;
  _preview_reservations_method?: string;
  _preview_reservations_url?: string;
  _preview_social_links?: string;
}>;

// Allow-lists derived from the source-of-truth maps so adding a new style or
// composition there automatically extends the preview allow-list — no second
// place to update, no silent drop-on-the-floor.
const VALID_HERO_COMPOSITIONS = new Set<string>(
  (Object.keys(PALETTE_PRESETS) as ThemeStyle[]).flatMap(listValidHeroCompositions),
);
const VALID_SERVICES_COMPOSITIONS = new Set<string>(
  (Object.keys(PALETTE_PRESETS) as ThemeStyle[]).flatMap(listValidServicesCompositions),
);
const VALID_GALLERY_COMPOSITIONS = new Set<string>(
  (Object.keys(PALETTE_PRESETS) as ThemeStyle[]).flatMap(listValidGalleryCompositions),
);
const VALID_MENU_COMPOSITIONS = new Set<string>(
  (Object.keys(PALETTE_PRESETS) as ThemeStyle[]).flatMap(listValidMenuCompositions),
);
const VALID_STYLES = new Set<string>(Object.keys(PALETTE_PRESETS));

// Apply preview overrides to a context. Only invoked AFTER the caller has
// validated a claim token, so this can never affect a normal visitor —
// preview params on a tokenless request are dead.
function applyPreviewOverrides(
  ctx: PublicClientContext,
  overrides: {
    hero?: string;
    services?: string;
    gallery?: string;
    menu?: string;
    style?: string;
    orderingLinks?: string;
    reservationsMethod?: string;
    reservationsUrl?: string;
    socialLinks?: string;
  },
): PublicClientContext {
  const heroOk = overrides.hero && VALID_HERO_COMPOSITIONS.has(overrides.hero);
  const servicesOk =
    overrides.services && VALID_SERVICES_COMPOSITIONS.has(overrides.services);
  const galleryOk =
    overrides.gallery && VALID_GALLERY_COMPOSITIONS.has(overrides.gallery);
  const menuOk = overrides.menu && VALID_MENU_COMPOSITIONS.has(overrides.menu);
  const styleOk = overrides.style && VALID_STYLES.has(overrides.style as ThemeStyle);

  // Ordering links: parse the JSON payload defensively. A malformed param
  // shouldn't kill the whole preview — fall through to the saved value.
  let orderingLinksOverride: unknown[] | null = null;
  if (overrides.orderingLinks !== undefined) {
    try {
      const parsed = JSON.parse(overrides.orderingLinks);
      if (Array.isArray(parsed)) orderingLinksOverride = parsed;
    } catch {
      /* ignore — keep saved value */
    }
  }
  let socialLinksOverride: unknown[] | null = null;
  if (overrides.socialLinks !== undefined) {
    try {
      const parsed = JSON.parse(overrides.socialLinks);
      if (Array.isArray(parsed)) socialLinksOverride = parsed;
    } catch {
      /* ignore — keep saved value */
    }
  }
  const reservationsMethodOk =
    overrides.reservationsMethod !== undefined &&
    ['opentable', 'resy', 'tock', 'phone', 'walkin'].includes(overrides.reservationsMethod);

  if (
    !heroOk &&
    !servicesOk &&
    !galleryOk &&
    !menuOk &&
    !styleOk &&
    orderingLinksOverride === null &&
    socialLinksOverride === null &&
    !reservationsMethodOk &&
    overrides.reservationsUrl === undefined
  ) {
    return ctx;
  }

  // Section list mutation: when ordering_links override has items but the
  // sections array doesn't include 'ordering' (older restaurants), inject
  // it so the OrderingLinks dispatcher actually runs.
  let sections = parseSections(ctx.content.sections).map((s) => {
    if (s.type === 'hero' && heroOk) return { ...s, composition: overrides.hero };
    if (s.type === 'services' && servicesOk) return { ...s, composition: overrides.services };
    if (s.type === 'gallery' && galleryOk) return { ...s, composition: overrides.gallery };
    if (s.type === 'menu' && menuOk) return { ...s, composition: overrides.menu };
    return s;
  });

  if (orderingLinksOverride !== null && orderingLinksOverride.length > 0) {
    if (!sections.some((s) => s.type === 'ordering')) {
      sections = [...sections, { type: 'ordering', enabled: true, variant: 'buttons' }];
    }
  }
  if (reservationsMethodOk && !sections.some((s) => s.type === 'reservations')) {
    sections = [...sections, { type: 'reservations', enabled: true, variant: 'preview' }];
  }

  // Theme.style is a JSONB field; parseTheme is lenient about extras, so we
  // can spread the existing parsed theme and overwrite just `style`. The
  // template reads style for component branches AND palette/font fallbacks.
  const content = { ...ctx.content, sections };
  if (styleOk) {
    const currentTheme = parseTheme(ctx.content.theme);
    content.theme = { ...currentTheme, style: overrides.style as ThemeStyle };
  }
  if (orderingLinksOverride !== null) {
    content.ordering_links = orderingLinksOverride as typeof content.ordering_links;
  }
  if (reservationsMethodOk) {
    content.reservations_method = overrides.reservationsMethod as typeof content.reservations_method;
  }
  if (overrides.reservationsUrl !== undefined) {
    content.reservations_url =
      overrides.reservationsUrl.trim() === '' ? null : overrides.reservationsUrl;
  }
  if (socialLinksOverride !== null) {
    content.social_links = socialLinksOverride as typeof content.social_links;
  }

  return { ...ctx, content };
}

export default async function HostPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { host } = await params;
  const {
    t,
    _preview_hero,
    _preview_services,
    _preview_gallery,
    _preview_menu,
    _preview_style,
    _preview_ordering_links,
    _preview_reservations_method,
    _preview_reservations_url,
    _preview_social_links,
  } = await searchParams;
  const decodedHost = decodeURIComponent(host);
  const overrides = {
    hero: _preview_hero,
    services: _preview_services,
    gallery: _preview_gallery,
    menu: _preview_menu,
    style: _preview_style,
    orderingLinks: _preview_ordering_links,
    reservationsMethod: _preview_reservations_method,
    reservationsUrl: _preview_reservations_url,
    socialLinks: _preview_social_links,
  };

  // Path 1: Claimed clients — RLS-bound anon query.
  // Preview overrides DO NOT apply here — claimed sites are public, and we
  // never want a stranger constructing `?_preview_hero=...` to mutate what
  // visitors see. Path 1 also fails when an authenticated non-owner (the
  // admin) hits the site, because RLS hides the row from anyone who isn't
  // the owner. Those requests fall through to Path 2 with the token.
  const claimedContext = await getClaimedClientByHost(decodedHost);
  if (claimedContext) {
    return <Site context={claimedContext} />;
  }

  // Path 2: Token-gated access — pre-sale or admin editor preview of a
  // claimed site. Preview overrides apply here because possession of the
  // token already means "operator or someone the operator shared the link
  // with."
  if (t) {
    const tokenContext = await getClientByHostAndToken(decodedHost, t);
    if (tokenContext) {
      const ctx = applyPreviewOverrides(tokenContext, overrides);
      return <Site context={ctx} />;
    }
  }

  // No match on either path → clean 404, no enumeration detail
  notFound();
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { host } = await params;
  const { t } = await searchParams;
  const decodedHost = decodeURIComponent(host);

  const claimed = await getClaimedClientByHost(decodedHost);
  if (claimed) {
    return {
      title: `${claimed.client.business_name} — ${claimed.client.city}`,
      description: claimed.content.hero_subheadline ?? undefined,
      robots: { index: true, follow: true },
      ...(claimed.client.favicon_url && {
        icons: { icon: claimed.client.favicon_url, apple: claimed.client.favicon_url },
      }),
    };
  }

  if (t) {
    const tokenCtx = await getClientByHostAndToken(decodedHost, t);
    if (tokenCtx) {
      return {
        title: `${tokenCtx.client.business_name} — ${tokenCtx.client.city}`,
        description: tokenCtx.content.hero_subheadline ?? undefined,
        // Tokenized URLs (pre-sale or admin preview) must never be indexed
        robots: { index: false, follow: false },
        ...(tokenCtx.client.favicon_url && {
          icons: { icon: tokenCtx.client.favicon_url, apple: tokenCtx.client.favicon_url },
        }),
      };
    }
  }

  return { title: 'Not Found' };
}
