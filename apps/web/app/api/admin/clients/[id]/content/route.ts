import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server';
import { revalidateClientSite } from '@/lib/revalidation';
import type { Json } from '@dfy/db';

type RouteContext = { params: Promise<{ id: string }> };

const contentPatchSchema = z.object({
  hero_headline: z.string().max(80).optional(),
  // Empty string from the editor = "clear emphasis", normalized to null below.
  hero_headline_emphasis: z.string().max(30).optional(),
  hero_subheadline: z.string().max(160).optional(),
  hero_cta_text: z.string().max(20).optional(),
  about_title: z.string().max(60).optional(),
  about_body: z.string().max(800).optional(),
  // Booksy URLs carry long query strings; 500 leaves headroom over Calendly's
  // typical ~80-char paths.
  booking_method: z.enum(['calendly', 'booksy', 'phone', 'cuts']).optional(),
  booking_url: z.string().max(500).optional(),
  // Section labels — empty strings normalize to null so the template
  // falls back to its style-appropriate default.
  services_title: z.string().max(60).optional(),
  services_eyebrow: z.string().max(40).optional(),
  gallery_title: z.string().max(60).optional(),
  about_eyebrow: z.string().max(40).optional(),
  sections: z.string().optional(),   // JSON string from form
  theme: z.string().optional(),      // JSON string from form
  services: z.string().optional(),   // JSON string from form
  // Restaurant fields. ordering_links is a JSON array of {platform, url}.
  // reservations_method maps directly to the column's check constraint.
  ordering_links: z.string().optional(),
  reservations_method: z.enum(['opentable', 'resy', 'tock', 'phone', 'walkin']).optional(),
  reservations_url: z.string().max(500).optional(),
  // Footer social links — JSON array of {platform, url}. Empty url entries
  // stay in storage so the editor doesn't drop the platform between saves.
  social_links: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let rawBody: Record<string, unknown>;
  try {
    const ct = req.headers.get('content-type') ?? '';
    if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
      const form = await req.formData();
      rawBody = Object.fromEntries(form.entries()) as Record<string, unknown>;
    } else {
      rawBody = await req.json() as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const parsed = contentPatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  // Build a typed ContentUpdate — parse JSON fields if provided as strings
  type ContentUpdate = {
    hero_headline?: string;
    hero_headline_emphasis?: string | null;
    hero_subheadline?: string;
    hero_cta_text?: string;
    about_title?: string;
    about_body?: string;
    booking_method?: 'calendly' | 'booksy' | 'phone' | 'cuts';
    booking_url?: string | null;
    services_title?: string | null;
    services_eyebrow?: string | null;
    gallery_title?: string | null;
    about_eyebrow?: string | null;
    sections?: Json;
    services?: Json;
    theme?: Json;
    ordering_links?: Json | null;
    reservations_method?: 'opentable' | 'resy' | 'tock' | 'phone' | 'walkin' | null;
    reservations_url?: string | null;
    social_links?: Json | null;
  };

  const update: ContentUpdate = {};
  const {
    sections: sectionsRaw,
    services: servicesRaw,
    theme: themeRaw,
    hero_headline_emphasis: emphasisRaw,
    services_title: servicesTitleRaw,
    services_eyebrow: servicesEyebrowRaw,
    gallery_title: galleryTitleRaw,
    about_eyebrow: aboutEyebrowRaw,
    booking_url: bookingUrlRaw,
    booking_method: bookingMethodRaw,
    ordering_links: orderingLinksRaw,
    reservations_method: reservationsMethodRaw,
    reservations_url: reservationsUrlRaw,
    social_links: socialLinksRaw,
    ...textFields
  } = parsed.data;
  Object.assign(update, textFields);

  // Empty string from the form means "clear emphasis" — store NULL so the
  // template falls back to plain headline rendering.
  if (emphasisRaw !== undefined) {
    update.hero_headline_emphasis = emphasisRaw.trim() === '' ? null : emphasisRaw;
  }

  if (bookingMethodRaw !== undefined) {
    update.booking_method = bookingMethodRaw;
  }

  // Empty string clears the booking URL back to NULL so unclaimed sites fall
  // through to the demo and claimed sites suppress the section.
  if (bookingUrlRaw !== undefined) {
    update.booking_url = bookingUrlRaw.trim() === '' ? null : bookingUrlRaw;
  }

  // Section labels — empty string clears back to template default. Only
  // assign when the field was actually present in the form payload, so we
  // don't accidentally null out columns the editor didn't touch.
  const setLabel = (
    key: 'services_title' | 'services_eyebrow' | 'gallery_title' | 'about_eyebrow',
    raw: string | undefined,
  ) => {
    if (raw === undefined) return;
    update[key] = raw.trim() === '' ? null : raw;
  };
  setLabel('services_title', servicesTitleRaw);
  setLabel('services_eyebrow', servicesEyebrowRaw);
  setLabel('gallery_title', galleryTitleRaw);
  setLabel('about_eyebrow', aboutEyebrowRaw);

  if (sectionsRaw !== undefined) {
    try {
      update.sections = JSON.parse(sectionsRaw);
    } catch {
      return NextResponse.json({ error: 'invalid_sections_json' }, { status: 400 });
    }
  }

  // Auto-include restaurant sections when their backing data shows up.
  // Restaurants generated before the ordering / reservations sections shipped
  // won't have those entries in their sections array — without this defensive
  // insert, populating the data fields would silently no-op because the
  // dispatcher in Site.tsx only renders sections listed in content.sections.
  //
  // When a `dine` (combined) section is present it already covers both
  // ordering and reservations — skip the individual inserts.
  const sectionsArr = Array.isArray(update.sections)
    ? (update.sections as Array<Record<string, unknown>>)
    : null;
  const hasDine = sectionsArr?.some((s) => s['type'] === 'dine') ?? false;
  const ensureSection = (type: string, variant: string) => {
    if (!sectionsArr) return;
    if (sectionsArr.some((s) => s['type'] === type)) return;
    sectionsArr.push({ type, enabled: true, variant });
  };
  if (orderingLinksRaw !== undefined && update.ordering_links !== null && !hasDine) {
    ensureSection('ordering', 'buttons');
  }
  if (reservationsMethodRaw !== undefined && !hasDine) {
    ensureSection('reservations', reservationsMethodRaw);
  }
  if (themeRaw !== undefined) {
    try {
      update.theme = JSON.parse(themeRaw);
    } catch {
      return NextResponse.json({ error: 'invalid_theme_json' }, { status: 400 });
    }
  }
  if (servicesRaw !== undefined) {
    try {
      update.services = JSON.parse(servicesRaw);
    } catch {
      return NextResponse.json({ error: 'invalid_services_json' }, { status: 400 });
    }
  }

  // Restaurant fields. Empty string / empty array clears back to NULL so the
  // section returns null rather than rendering an empty block.
  if (orderingLinksRaw !== undefined) {
    try {
      const parsedLinks = JSON.parse(orderingLinksRaw);
      if (!Array.isArray(parsedLinks)) {
        return NextResponse.json({ error: 'invalid_ordering_links_json' }, { status: 400 });
      }
      update.ordering_links = parsedLinks.length === 0 ? null : (parsedLinks as Json);
    } catch {
      return NextResponse.json({ error: 'invalid_ordering_links_json' }, { status: 400 });
    }
  }
  if (reservationsMethodRaw !== undefined) {
    update.reservations_method = reservationsMethodRaw;
  }
  if (reservationsUrlRaw !== undefined) {
    update.reservations_url = reservationsUrlRaw.trim() === '' ? null : reservationsUrlRaw;
  }

  // Socials. Empty array stores NULL so the footer falls through to the
  // no-icons render path. Filled entries — including ones with empty urls —
  // are preserved so the editor doesn't drop platforms between saves.
  if (socialLinksRaw !== undefined) {
    try {
      const parsedSocials = JSON.parse(socialLinksRaw);
      if (!Array.isArray(parsedSocials)) {
        return NextResponse.json({ error: 'invalid_social_links_json' }, { status: 400 });
      }
      update.social_links = parsedSocials.length === 0 ? null : (parsedSocials as Json);
    } catch {
      return NextResponse.json({ error: 'invalid_social_links_json' }, { status: 400 });
    }
  }

  const { error: updateError } = await admin
    .from('content')
    .update(update)
    .eq('client_id', id)
    .eq('is_published', true);

  if (updateError) {
    return NextResponse.json({ error: 'update_failed', detail: updateError.message }, { status: 500 });
  }

  await admin.from('events').insert({
    client_id: id,
    type: 'admin_content_update',
    metadata: { updated_fields: Object.keys(update), admin: user.email },
  });

  // Fetch client for revalidation
  const { data: client } = await admin
    .from('clients')
    .select('slug, custom_domain')
    .eq('id', id)
    .single();

  if (client) revalidateClientSite(client.slug, client.custom_domain);

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  return PATCH(req, ctx);
}
