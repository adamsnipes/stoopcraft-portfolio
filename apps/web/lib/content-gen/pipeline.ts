// Shared generation pipeline — called by both /api/admin/generate (admin form)
// and /api/generate (public landing-page flow). Encapsulates everything from
// "I have a Google Place ID + niche" through "client row, content row, and
// photos all persisted" so both call sites stay in sync.
//
// The admin route adds its own auth + input-shape validation around this; the
// public route adds rate-limiting + niche inference around it.

import { fetchPlaceData, fetchAndRankPhotos } from '@/lib/places';
import { storePhotoFromBuffer, attachFallbackPhotos } from '@/lib/r2/photos';
import { generateSlug } from '@/lib/content-gen/slug';
import {
  generateSiteContent,
  generateMenuSkeleton,
  getNicheProfile,
  type Niche,
} from '@/lib/content-gen/generate';
import {
  pickCompositions,
  hashString,
  isRestaurantStyle,
  isTradesStyle,
  type PickerSignals,
} from '@/lib/content-gen/compositions';
import { scrapeMenuFromUberEats } from '@/lib/content-gen/menu-scraper';
import { createServiceRoleClient } from '@/lib/supabase/server';
import sharp from 'sharp';
import type { ContentInsert } from '@dfy/db';

export type PipelineInput = {
  google_place_id: string;
  niche: Niche;
  industry_label: string | null;
  // Force the restaurant template family even if the niche profile doesn't.
  // Used when inference picks 'other' but Google's types say it's a
  // restaurant — so the site still ships menu/reservations sections.
  vertical_override?: 'restaurant';
  // Where the generation request came from — written to events.metadata.source
  // so we can see admin-typed vs landing-page funnel volume.
  source: 'admin' | 'public';
  // Client-generated UUID, persisted on the new clients row for log
  // correlation in Axiom. Only the public funnel passes this; admin
  // generation leaves it undefined and the column stays NULL.
  funnel_session_id?: string | null;
  // Attribution: the sales rep responsible for the lead. Resolved from
  // the referral cookie (/r/<code>) at the route-handler level so the
  // pipeline doesn't need to know about cookies. NULL = unattributed.
  sales_rep_id?: string | null;
  // The utm_source from the referral click (twitter, youtube, newsletter…).
  // Stamped onto the clients row so the affiliate dashboard can break
  // conversions down by channel. NULL when the click had no utm_source or
  // the row was created via the rep-generate path (not through /r/<code>).
  referral_utm_source?: string | null;
};

export type PipelineSuccess = {
  ok: true;
  client_id: string;
  slug: string;
  short_code: string;
  claim_token: string;
  business_name: string;
  phone_number: string | null;
  google_place_id: string;
  compositions: Record<string, string | undefined>;
};

export type PipelineFailure = {
  ok: false;
  // Status is the HTTP status the caller should return; the same shape is
  // useful for both Next route handlers and the admin form.
  status: 400 | 409 | 422 | 500;
  error:
    | 'place_not_found'
    | 'business_not_operational'
    | 'duplicate_place_id'
    | 'duplicate_phone'
    | 'generation_failed'
    | 'menu_generation_failed'
    | 'db_insert_failed'
    | 'content_insert_failed';
  client_id?: string;
  // Populated only for duplicate_place_id — the landing page uses these
  // to render the existing site instead of bouncing the visitor with a
  // generic error. Safe to expose: slug is public, business_name is
  // public on the site, status is non-sensitive.
  slug?: string;
  business_name?: string;
  existing_status?: string;
  // Only set when the duplicate's status is 'live' (unclaimed). Lets the
  // landing page render the iframe + claim wizard exactly as it would for
  // a fresh generation, so a returning owner can finish checkout without
  // having to find their save-preview email. We deliberately omit this
  // field for 'claimed' duplicates: that site has an owner already, and
  // /api/checkout/claim rejects already-claimed clients regardless of
  // token possession — but withholding the token keeps the defense in
  // depth obvious in the response shape.
  claim_token?: string;
  // Mirror of the fresh-gen success path so the landing page can offer
  // the same Copy/share affordance for live duplicates. Same scope as
  // claim_token above.
  short_code?: string;
};

export type PipelineResult = PipelineSuccess | PipelineFailure;

export async function generateClientSite(input: PipelineInput): Promise<PipelineResult> {
  const {
    google_place_id,
    niche,
    industry_label,
    vertical_override,
    source,
    funnel_session_id,
    sales_rep_id,
    referral_utm_source,
  } = input;

  const place = await fetchPlaceData(google_place_id);
  if (!place) return { ok: false, status: 422, error: 'place_not_found' };
  if (place.business_status !== 'OPERATIONAL') {
    return { ok: false, status: 400, error: 'business_not_operational' };
  }
  // Pure service-area businesses (mobile detailers, cleaners, etc.) often
  // come back from Places with no locality/admin_area components — empty
  // city/state is allowed; downstream prompts and rendering handle it.

  const supabase = createServiceRoleClient();

  const { data: existingByPlace } = await supabase
    .from('clients')
    .select(
      'id, slug, business_name, status, claim_token, short_code, sales_rep_id, phone',
    )
    .eq('google_place_id', google_place_id)
    .maybeSingle();
  if (existingByPlace) {
    // Already paid for — never let a rep "take over" a paying customer's row.
    if (existingByPlace.status === 'claimed') {
      return {
        ok: false,
        status: 409,
        error: 'duplicate_place_id',
        client_id: existingByPlace.id,
        slug: existingByPlace.slug,
        business_name: existingByPlace.business_name,
        existing_status: existingByPlace.status,
      };
    }

    // Unclaimed (status='live' or earlier). Attribution rule: whoever
    // generates / cookie-clicks NOW takes attribution from whoever had it
    // before. We only overwrite when the caller is bringing a rep id —
    // an organic visit with no cookie doesn't strip an existing rep.
    if (
      sales_rep_id &&
      existingByPlace.sales_rep_id !== sales_rep_id
    ) {
      const previousRepId = existingByPlace.sales_rep_id;
      await supabase
        .from('clients')
        .update({ sales_rep_id })
        .eq('id', existingByPlace.id);
      await supabase.from('events').insert({
        client_id: existingByPlace.id,
        type: 'rep_attribution_changed',
        metadata: {
          from_sales_rep_id: previousRepId,
          to_sales_rep_id: sales_rep_id,
          source,
        },
      });
    }

    // Return the existing site as if it were a fresh success — the rep
    // (or the public funnel) gets the preview link + claim_token to share.
    // claim_token is always present on a clients row, so we surface it
    // unconditionally for unclaimed rows.
    return {
      ok: true,
      client_id: existingByPlace.id,
      slug: existingByPlace.slug,
      short_code: existingByPlace.short_code ?? '',
      claim_token: existingByPlace.claim_token ?? '',
      business_name: existingByPlace.business_name,
      phone_number: existingByPlace.phone ?? null,
      google_place_id,
      compositions: {},
    };
  }

  if (place.phone) {
    const { data: existingByPhone } = await supabase
      .from('clients')
      .select('id')
      .eq('phone', place.phone)
      .maybeSingle();
    if (existingByPhone) {
      return {
        ok: false,
        status: 409,
        error: 'duplicate_phone',
        client_id: existingByPhone.id,
      };
    }
  }

  // ── 1. Photos first ───────────────────────────────────────────────────────
  // Fetched and ranked BEFORE content generation so:
  //   (a) composition selection has photo signals to dispatch on, and
  //   (b) a Places fetch failure doesn't leave an orphan `clients` row.
  const photoNicheLabel = industry_label ?? niche;
  const rankedPhotos = await fetchAndRankPhotos(place.photo_references, photoNicheLabel);

  const photoSignals = await Promise.all(
    rankedPhotos.map(async (p) => {
      try {
        const meta = await sharp(p.buffer).metadata();
        const w = meta.width ?? 0;
        const h = meta.height ?? 0;
        return { landscape: w >= h && w > 0, portrait: h > w && h > 0 };
      } catch {
        return { landscape: false, portrait: false };
      }
    }),
  );
  const hasLandscape = photoSignals.some((p) => p.landscape);
  const hasPortrait = photoSignals.some((p) => p.portrait);

  // ── 2. Content generation ─────────────────────────────────────────────────
  let content;
  try {
    content = await generateSiteContent({
      business_name: place.business_name,
      niche,
      city: place.city,
      state: place.state,
      ...(industry_label ? { industry_label } : {}),
    });
  } catch (err) {
    console.error('generateSiteContent failed', {
      business_name: place.business_name,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, status: 500, error: 'generation_failed' };
  }

  // ── 3. Client row ────────────────────────────────────────────────────────
  const slug = generateSlug(place.business_name);
  const claim_token = `tok_${crypto.randomUUID().replace(/-/g, '')}`;
  const shortPrefix = place.business_name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20)
    .replace(/-+$/, '');
  const short_code = `${shortPrefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 6)}`;

  const profile = getNicheProfile(niche);
  // Restaurant routing — either the niche profile says so, or the caller
  // passed vertical_override (used when inference lands on 'other' but
  // Google's types say "restaurant").
  const isRestaurant = profile.vertical === 'restaurant' || vertical_override === 'restaurant';
  // Trades routing — driven entirely by the niche profile today (each trade
  // niche pins vertical: 'trades'). Inferred-trades override path can be
  // added later via vertical_override === 'trades' if 'other' niche callers
  // need it.
  const isTrades = profile.vertical === 'trades';

  // Safety net: enforce a restaurant style on restaurant clients. The LLM
  // is hinted to pick the right restaurant-* style but can't be trusted to
  // always comply, and using a non-restaurant style on a restaurant client
  // would route through the wrong section components.
  if (isRestaurant && !isRestaurantStyle(content.theme.style)) {
    // If the profile pins a restaurant style use that; otherwise pick a
    // sensible default for the inferred-restaurant 'other' case.
    content.theme.style = isRestaurantStyle(profile.style) ? profile.style : 'restaurant-modern';
  }
  // Same safety net for trades — LLM might have honored the design hint but
  // picked an aesthetic style (e.g. 'minimal' for a painter); force the
  // trades-* family so the lead-gen sections actually render.
  if (isTrades && !isTradesStyle(content.theme.style)) {
    content.theme.style = isTradesStyle(profile.style) ? profile.style : 'trades-classic';
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      slug,
      status: 'live',
      niche,
      google_place_id,
      business_name: place.business_name,
      phone: place.phone,
      address: place.address,
      city: place.city,
      state: place.state,
      lat: place.lat,
      lng: place.lng,
      claim_token,
      short_code,
      business_vertical: isRestaurant ? 'restaurant' : isTrades ? 'trades' : null,
      ...(funnel_session_id ? { funnel_session_id } : {}),
      ...(sales_rep_id ? { sales_rep_id } : {}),
      ...(referral_utm_source ? { referral_utm_source } : {}),
    })
    .select('id')
    .single();

  if (clientError || !client) {
    console.error('client insert failed', { error: clientError?.message });
    return { ok: false, status: 500, error: 'db_insert_failed' };
  }

  // ── 4. Composition selection ─────────────────────────────────────────────
  const signals: PickerSignals = {
    photoCount: rankedPhotos.length,
    hasLandscape,
    hasPortrait,
    headlineWords: content.hero.headline.trim().split(/\s+/).length,
    serviceCount: content.services.length,
    hash: hashString(client.id),
  };
  const compositions = pickCompositions(content.theme.style, signals);

  // ── 4b. Section list — branches on vertical ──────────────────────────────
  const sections: { type: string; enabled: boolean; variant: string; composition?: string }[] = [];

  if (isTrades) {
    // Trades section list is ORDER-CRITICAL: lead form first, trust signals
    // immediately after, then services, why-us, social proof, CTA strip,
    // then footer-tier (location/hours/contact). This sequencing is what
    // separates a "free estimate" lead-gen page from a brochure site.
    sections.push({ type: 'top_bar',  enabled: true, variant: 'utility' });
    sections.push({
      type: 'hero', enabled: true,
      variant: profile.variants.hero,
      composition: compositions.hero, // pickCompositions forces 'lead-form-split'
    });
    sections.push({ type: 'trust_bar', enabled: true, variant: 'pills' });
    sections.push({
      type: 'services', enabled: true,
      variant: profile.variants.services,
      composition: compositions.services,
    });
    sections.push({ type: 'why_us',       enabled: true, variant: 'bento' });
    sections.push({ type: 'testimonials', enabled: true, variant: 'cards' });
    if (compositions.gallery !== 'off') {
      sections.push({
        type: 'gallery', enabled: true,
        variant: profile.variants.gallery,
        composition: compositions.gallery,
      });
    }
    sections.push({ type: 'cta_strip', enabled: true, variant: 'band' });
    sections.push({ type: 'hours',     enabled: true, variant: 'list' });
    sections.push({ type: 'contact',   enabled: true, variant: 'form' });
    // No `location` / `follow` / `booking` / `about` for trades by default.
    // A contractor that comes to your house doesn't benefit from a big "find
    // us" map — the office isn't where the work happens, and the map dilutes
    // the page's lead-gen focus. Admin can toggle it on if a particular
    // client wants a showroom anchor.
  } else {
    sections.push({
      type: 'hero', enabled: true,
      variant: profile.variants.hero,
      composition: compositions.hero,
    });
    if (isRestaurant) {
      sections.push({
        type: 'menu', enabled: true,
        variant: 'printed',
        composition: compositions.menu ?? 'accordion-menu',
      });
      // Dine With Us — combined Order + Reservations card directly under the
      // menu so visitors who decide to order delivery or book a table after
      // scanning the menu don't have to scroll past about / gallery first.
      // Admin can split this back into two separate sections from the editor.
      sections.push({ type: 'dine', enabled: true, variant: 'card' });
    } else {
      sections.push({
        type: 'services', enabled: true,
        variant: profile.variants.services,
        composition: compositions.services,
      });
    }

    if (compositions.gallery !== 'off') {
      sections.push({
        type: 'gallery', enabled: true,
        variant: profile.variants.gallery,
        composition: compositions.gallery,
      });
    }

    sections.push({
      type: 'about', enabled: true,
      variant: profile.variants.about,
      composition: compositions.about,
    });

    if (isRestaurant) {
      sections.push({ type: 'hours', enabled: true, variant: 'list' });
      sections.push({ type: 'location', enabled: true, variant: 'map' });
    } else {
      sections.push({ type: 'booking', enabled: true, variant: 'embed' });
      sections.push({ type: 'contact', enabled: true, variant: 'form' });
    }
    // Cross-vertical sections live in every default section list so the editor
    // can toggle them per client. Default-enabled across verticals — every
    // local business benefits from surfacing Instagram/TikTok, and the empty-
    // URL placeholders render as non-clickable previews until the customer
    // wires up real handles after claiming.
    sections.push({ type: 'follow', enabled: true, variant: 'icons' });
  }

  // ── 4c. Restaurant menu — scrape first, LLM skeleton as fallback ─────────
  // Try Uber Eats first via the external scraper service. If we get a real
  // menu we ship the restaurant's actual dishes; on miss / timeout / any
  // scraper error we fall through to the LLM-generated placeholder so the
  // site never ships menu-less. Both paths produce a MenuConfig.
  let menuSkeleton = null;
  if (isRestaurant) {
    const scrapeStartedAt = Date.now();
    const scrape =
      place.lat != null && place.lng != null
        ? await scrapeMenuFromUberEats({
            business_name: place.business_name,
            lat: place.lat,
            lng: place.lng,
          })
        : ({ status: 'disabled' } as const);

    // One structured log line per restaurant generation so Axiom can answer
    // "what % of restaurants got a real scraped menu?" with a single query.
    console.log(
      JSON.stringify({
        flow: 'build-site',
        event: 'menu_scrape',
        status: scrape.status,
        client_id: client.id,
        business_name: place.business_name,
        ms: Date.now() - scrapeStartedAt,
        ...(funnel_session_id ? { funnel_session_id } : {}),
        ...('itemCount' in scrape ? { item_count: scrape.itemCount } : {}),
        ...('reason' in scrape ? { reason: scrape.reason } : {}),
      }),
    );

    if (scrape.status === 'hit') {
      menuSkeleton = scrape.menu;
    } else {
      try {
        menuSkeleton = await generateMenuSkeleton({
          niche,
          business_name: place.business_name,
          city: place.city,
          state: place.state,
          ...(industry_label ? { industry_label } : {}),
        });
      } catch (err) {
        console.error('generateMenuSkeleton failed', {
          client_id: client.id,
          error: err instanceof Error ? err.message : String(err),
        });
        await supabase.from('clients').delete().eq('id', client.id);
        return { ok: false, status: 500, error: 'menu_generation_failed' };
      }
    }
  }

  const contentInsert: ContentInsert = {
    client_id: client.id,
    version: 1,
    is_published: true,
    hero_headline: content.hero.headline,
    hero_headline_emphasis: content.hero.headline_emphasis ?? null,
    hero_subheadline: content.hero.subheadline,
    hero_cta_text: content.hero.cta_text,
    about_title: content.about.title,
    about_body: content.about.body,
    services: content.services,
    theme: content.theme,
    sections,
    // Empty-URL placeholders so admins / customers see the platforms in the
    // editor without typing them in. The Follow section renders these as
    // non-clickable previews so unclaimed sites still show what the section
    // looks like — customers wire up real URLs after claiming.
    social_links: [
      { platform: 'tiktok', url: '' },
      { platform: 'instagram', url: '' },
      { platform: 'facebook', url: '' },
    ],
    ...(menuSkeleton
      ? {
          menu: menuSkeleton,
          reservations_method: 'walkin',
          ordering_links: [
            { platform: 'doordash', url: '' },
            { platform: 'ubereats', url: '' },
          ],
        }
      : {}),
  };

  const { error: contentError } = await supabase.from('content').insert(contentInsert);
  if (contentError) {
    console.error('content insert failed', { client_id: client.id, error: contentError.message });
    await supabase.from('clients').delete().eq('id', client.id);
    return { ok: false, status: 500, error: 'content_insert_failed' };
  }

  // ── 5. Persist photos ────────────────────────────────────────────────────
  if (rankedPhotos.length > 0) {
    for (let i = 0; i < rankedPhotos.length; i++) {
      const stored = await storePhotoFromBuffer(client.id, rankedPhotos[i]!.buffer);
      if (stored) {
        await supabase.from('photos').insert({
          client_id: client.id,
          ...stored,
          position: i,
          source: 'google',
        });
      }
    }
  } else {
    await attachFallbackPhotos(client.id, niche);
  }

  await supabase.from('events').insert({
    client_id: client.id,
    type: 'generated',
    metadata: {
      source,
      niche,
      style: content.theme.style,
      compositions,
      ...(industry_label ? { industry_label } : {}),
      ...(vertical_override ? { vertical_override } : {}),
    },
  });

  return {
    ok: true,
    client_id: client.id,
    slug,
    short_code,
    claim_token,
    business_name: place.business_name,
    phone_number: place.phone ?? null,
    google_place_id,
    compositions,
  };
}
