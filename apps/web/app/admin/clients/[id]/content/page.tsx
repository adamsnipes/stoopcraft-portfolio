import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  parseSections,
  parseTheme,
  parseServices,
  parseOrderingLinks,
  parseSocialLinks,
} from '@/lib/tenant';
import { ContentEditor } from './ContentEditor';
import { clientSubdomainHost } from '@/lib/marketing-brand';
import type { BookingMethod } from '@dfy/db';

function asBookingMethod(value: string | null | undefined): BookingMethod {
  return value === 'booksy' || value === 'phone' || value === 'cuts' ? value : 'calendly';
}

type Params = Promise<{ id: string }>;

export default async function ContentEditorPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, slug, business_name, custom_domain, status, claim_token, business_vertical, niche, brand')
    .eq('id', id)
    .single();
  if (!client) notFound();

  const { data: content } = await supabase
    .from('content')
    .select('*')
    .eq('client_id', id)
    .eq('is_published', true)
    .single();
  if (!content) notFound();

  // ── Preview URL ─────────────────────────────────────────────────────────
  // Customer sites always render at /sites/{hostname} internally. On
  // production, hitting `https://slug.stoopcraft.com` flows through proxy.ts
  // which rewrites to that path. On localhost there's no DNS for the
  // subdomain, so we point the iframe directly at the path.
  const headersList = await headers();
  const requestHost = headersList.get('host') ?? '';
  const isLocal = requestHost.startsWith('localhost') || requestHost.startsWith('127.0.0.1');
  // Always preview via the client's subdomain even when the client has a
  // custom_domain. The proxy resolves slug.PLATFORM_DOMAIN (or, for brand
  // clients, slug.stupidcheapwebsites.com) to the same row, and this keeps the
  // iframe inside the admin CSP's frame-src for those two wildcards —
  // embedding the custom domain directly triggers a CSP violation.
  const customerHost = clientSubdomainHost(client);
  // Preview overrides (_preview_style, _preview_hero, _preview_services)
  // only apply on the page route's token-gated path. Claimed sites also need
  // the token for two reasons: (1) preview overrides apply, and (2) the
  // admin's authenticated session isn't the owner_user_id, so RLS hides the
  // row from Path 1 — the token path is what makes the iframe render at all.
  const tokenSuffix = client.claim_token
    ? `?t=${encodeURIComponent(client.claim_token)}`
    : '';
  const previewUrl = isLocal
    ? `http://${requestHost}/sites/${encodeURIComponent(customerHost)}${tokenSuffix}`
    : `https://${customerHost}${tokenSuffix}`;

  return (
    <div>
      <p className="mb-5 text-sm text-ink-700/70">
        Edit copy, theme, and layout. Save to push live and reload preview.
      </p>

      <ContentEditor
        clientId={id}
        previewUrl={previewUrl}
        businessVertical={client.business_vertical}
        niche={client.niche}
        initial={{
          hero_headline: content.hero_headline,
          hero_headline_emphasis: content.hero_headline_emphasis,
          hero_subheadline: content.hero_subheadline,
          hero_cta_text: content.hero_cta_text,
          about_title: content.about_title,
          about_body: content.about_body,
          booking_method: asBookingMethod(content.booking_method),
          booking_url: content.booking_url,
          services_title: content.services_title,
          services_eyebrow: content.services_eyebrow,
          gallery_title: content.gallery_title,
          about_eyebrow: content.about_eyebrow,
          sections: parseSections(content.sections),
          services: parseServices(content.services).map((s) => ({
            name: s.name,
            description: s.description ?? '',
            ...(s.price ? { price: s.price } : {}),
          })),
          theme: parseTheme(content.theme),
          ordering_links: parseOrderingLinks(content.ordering_links),
          reservations_method: (content.reservations_method as
            | 'opentable' | 'resy' | 'tock' | 'phone' | 'walkin'
            | null) ?? null,
          reservations_url: content.reservations_url,
          // Default to facebook+instagram placeholders for legacy rows that
          // pre-date the social_links column — the editor surfaces the two
          // most common platforms without needing a backfill.
          social_links: (() => {
            const parsed = parseSocialLinks(content.social_links);
            if (parsed.length > 0) return parsed;
            return content.social_links === null
              ? [
                  { platform: 'facebook' as const, url: '' },
                  { platform: 'instagram' as const, url: '' },
                ]
              : [];
          })(),
        }}
      />
    </div>
  );
}
