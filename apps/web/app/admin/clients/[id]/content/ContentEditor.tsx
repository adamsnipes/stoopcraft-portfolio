'use client';

import { useState, useTransition, useRef, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PALETTE_PRESETS } from '@/lib/content-gen/palettes';
import {
  listValidHeroCompositions,
  listValidServicesCompositions,
  listValidGalleryCompositions,
  listValidMenuCompositions,
} from '@/lib/content-gen/compositions';
import type {
  ThemeStyle,
  BookingMethod,
  OrderingLink,
  OrderingPlatform,
  ReservationsMethod,
  BackgroundTreatment,
  SocialLink,
  SocialPlatform,
} from '@dfy/db';

type Section = {
  type: string;
  enabled: boolean;
  variant: string;
  composition?: string;
};

type Theme = {
  primary: string;
  background: string;
  text: string;
  accent: string;
  fontHeading: string;
  fontBody: string;
  borderRadius?: string;
  style: ThemeStyle;
  // Optional decorative overlay layered atop the bg color. Off when undefined.
  background_treatment?: BackgroundTreatment;
  // Alt section bg override. When undefined / empty, the renderer derives a
  // ~4% tonal shift off `background`.
  background_alt?: string;
  // Master switch for the alternating-section-bg effect. Treat undefined as
  // `true` — explicit false disables.
  alt_bg_enabled?: boolean;
};

type Service = {
  name: string;
  description: string;
  price?: string;
};

type Content = {
  hero_headline: string | null;
  hero_headline_emphasis: string | null;
  hero_subheadline: string | null;
  hero_cta_text: string | null;
  about_title: string | null;
  about_body: string | null;
  booking_method: BookingMethod;
  booking_url: string | null;
  services_title: string | null;
  services_eyebrow: string | null;
  gallery_title: string | null;
  about_eyebrow: string | null;
  sections: Section[];
  services: Service[];
  theme: Theme;
  // Restaurant-only — null for non-restaurant clients.
  ordering_links: OrderingLink[];
  reservations_method: ReservationsMethod | null;
  reservations_url: string | null;
  // Footer + Follow section socials. The Follow section renders empty-URL
  // entries as non-clickable preview buttons; the footer hides them.
  social_links: SocialLink[];
};

const SOCIAL_PLATFORMS_LIST: { id: SocialPlatform; label: string; placeholder: string }[] = [
  { id: 'facebook',  label: 'Facebook',  placeholder: 'https://facebook.com/yourbusiness' },
  { id: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourbusiness' },
  { id: 'tiktok',    label: 'TikTok',    placeholder: 'https://tiktok.com/@yourbusiness' },
  { id: 'youtube',   label: 'YouTube',   placeholder: 'https://youtube.com/@yourbusiness' },
  { id: 'twitter',   label: 'Twitter / X', placeholder: 'https://x.com/yourbusiness' },
  { id: 'linkedin',  label: 'LinkedIn',  placeholder: 'https://linkedin.com/company/yourbusiness' },
];

const ORDERING_PLATFORMS: { id: OrderingPlatform; label: string }[] = [
  { id: 'doordash', label: 'DoorDash' },
  { id: 'ubereats', label: 'Uber Eats' },
  { id: 'grubhub', label: 'Grubhub' },
  { id: 'postmates', label: 'Postmates' },
  { id: 'chownow', label: 'ChowNow' },
  { id: 'toast', label: 'Toast' },
  { id: 'square', label: 'Square Online' },
  { id: 'direct', label: 'Order direct' },
];

const RESERVATION_METHODS: { id: ReservationsMethod; label: string; needsUrl: boolean; description: string }[] = [
  { id: 'walkin',    label: 'Walk-ins only',  needsUrl: false, description: 'No reservation system — section shows "Walk-ins welcome".' },
  { id: 'opentable', label: 'OpenTable',       needsUrl: true,  description: 'Link out to your OpenTable reservation page.' },
  { id: 'resy',      label: 'Resy',            needsUrl: true,  description: 'Link out to your Resy reservation page.' },
  { id: 'tock',      label: 'Tock',            needsUrl: true,  description: 'Link out to your Tock reservation / ticketing page.' },
  { id: 'phone',     label: 'Phone only',      needsUrl: false, description: 'Tap-to-call to the business phone number.' },
];

const HEADING_FONTS = [
  'Playfair Display',
  'Fraunces',
  'Cormorant Garamond',
  'Inter',
  'Merriweather',
  'Bebas Neue',
  'Poppins',
  'Space Grotesk',
  'Bowlby One',
  'Anton',
  'Italiana',
  'Audiowide',
];

const BODY_FONTS = ['Inter', 'Lora', 'Open Sans', 'Roboto', 'DM Sans', 'Nunito', 'Space Mono'];

// Record forces TS exhaustiveness — adding a new ThemeStyle to the union
// without listing it here is a compile error, not a silently-missing dropdown
// option.  Order = display order in the picker.
const STYLE_ORDER: Record<ThemeStyle, number> = {
  editorial: 0,
  luxe: 1,
  'premium-dark': 2,
  bold: 3,
  minimal: 4,
  'service-tech': 5,
  'flagship-atelier': 6,
  // Restaurant styles. Filtered out of the picker for non-restaurant
  // clients at the consumer of STYLES below — entries here exist purely
  // for TS exhaustiveness on the Record.
  'restaurant-trattoria': 7,
  'restaurant-modern': 8,
  'restaurant-cafe': 9,
  'restaurant-omakase': 10,
  'restaurant-counter': 11,
  // Trades styles. Like restaurants, filtered out of the picker for
  // non-trades clients at the consumer level — entries here exist for
  // TS exhaustiveness.
  'trades-classic': 12,
  'trades-bold': 13,
  'playful-pop': 14,
  brutalist: 15,
  'art-deco': 16,
  'retro-90s': 17,
};

// Canonical heading/body font pair per style. Used by switchStyle to apply a
// coherent typographic identity along with the palette and compositions.
// Keep these inside ALLOWED_HEADING_FONTS / ALLOWED_BODY_FONTS in schema.ts.
const STYLE_DEFAULT_FONTS: Record<ThemeStyle, { fontHeading: string; fontBody: string }> = {
  editorial: { fontHeading: 'Fraunces', fontBody: 'Inter' },
  luxe: { fontHeading: 'Playfair Display', fontBody: 'Lora' },
  'premium-dark': { fontHeading: 'Bebas Neue', fontBody: 'Roboto' },
  bold: { fontHeading: 'Bebas Neue', fontBody: 'Inter' },
  minimal: { fontHeading: 'Inter', fontBody: 'Inter' },
  'service-tech': { fontHeading: 'Space Grotesk', fontBody: 'Inter' },
  'flagship-atelier': { fontHeading: 'Fraunces', fontBody: 'Inter' },
  'restaurant-trattoria': { fontHeading: 'Playfair Display', fontBody: 'Lora' },
  'restaurant-modern': { fontHeading: 'Cormorant Garamond', fontBody: 'DM Sans' },
  'restaurant-cafe': { fontHeading: 'Fraunces', fontBody: 'DM Sans' },
  'restaurant-omakase': { fontHeading: 'Cormorant Garamond', fontBody: 'Inter' },
  'restaurant-counter': { fontHeading: 'Bebas Neue', fontBody: 'Inter' },
  // Trades — clean modern sans matches the lead-gen contractor reference.
  'trades-classic': { fontHeading: 'Inter', fontBody: 'Inter' },
  'trades-bold': { fontHeading: 'Bebas Neue', fontBody: 'Inter' },
  'playful-pop': { fontHeading: 'Bowlby One', fontBody: 'Nunito' },
  brutalist: { fontHeading: 'Anton', fontBody: 'Space Mono' },
  'art-deco': { fontHeading: 'Italiana', fontBody: 'Lora' },
  'retro-90s': { fontHeading: 'Audiowide', fontBody: 'Space Mono' },
};
const STYLES: ThemeStyle[] = (Object.keys(STYLE_ORDER) as ThemeStyle[]).sort(
  (a, b) => STYLE_ORDER[a] - STYLE_ORDER[b],
);

export function ContentEditor({
  clientId,
  initial,
  previewUrl,
  businessVertical,
  niche,
}: {
  clientId: string;
  initial: Content;
  previewUrl: string;
  // null for the existing beauty/appointment-based template family.
  // 'restaurant' swaps the Services / Booking / Section-label panels for
  // restaurant-appropriate equivalents (Menu link, no Booking, etc.).
  businessVertical: string | null;
  // Per-niche editor surface tweaks (e.g. The Cut booking option for
  // 'barber'). NULL on legacy clients seeded before niche existed.
  niche: string | null;
}) {
  const isRestaurant = businessVertical === 'restaurant';
  const isBarbershop = niche === 'barber';
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState<null | 'ok' | 'error'>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Iframe reload key — bumped after each save to force a fresh render.
  const [previewKey, setPreviewKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Preview device toggle — mobile (390px) vs desktop (1280px scaled-to-fit).
  // Desktop renders at 1280 to show the actual desktop layout, then scales
  // down to whatever the preview column width is via transform: scale().
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('desktop');
  const [previewMaximized, setPreviewMaximized] = useState(false);
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const fullscreenFrameRef = useRef<HTMLDivElement>(null);
  const [previewContainerWidth, setPreviewContainerWidth] = useState(0);
  const [fullscreenContainerWidth, setFullscreenContainerWidth] = useState(0);

  // useLayoutEffect: measure synchronously after DOM mutation but BEFORE paint,
  // so the iframe is never painted at the wrong scale. Plain useEffect runs
  // after paint and produces a "cut off, seems centered" flash where the
  // unscaled 1280-wide iframe overflows a narrower column and gets clipped.
  useLayoutEffect(() => {
    if (previewMaximized) return;
    const el = previewFrameRef.current;
    if (!el) return;
    const compute = () => setPreviewContainerWidth(el.clientWidth);
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewMaximized]);

  useLayoutEffect(() => {
    if (!previewMaximized) return;
    const el = fullscreenFrameRef.current;
    if (!el) return;
    const compute = () => setFullscreenContainerWidth(el.clientWidth);
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewMaximized]);

  // ESC closes the maximized preview.
  useEffect(() => {
    if (!previewMaximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewMaximized(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewMaximized]);

  // Local form state
  const [hero_headline, setHeroHeadline] = useState(initial.hero_headline ?? '');
  const [hero_headline_emphasis, setHeroEmphasis] = useState(
    initial.hero_headline_emphasis ?? '',
  );
  const [hero_subheadline, setHeroSubheadline] = useState(initial.hero_subheadline ?? '');
  const [hero_cta_text, setHeroCta] = useState(initial.hero_cta_text ?? '');
  const [about_title, setAboutTitle] = useState(initial.about_title ?? '');
  const [about_body, setAboutBody] = useState(initial.about_body ?? '');
  const [booking_method, setBookingMethod] = useState<BookingMethod>(initial.booking_method);
  const [booking_url, setBookingUrl] = useState(initial.booking_url ?? '');
  // Restaurant fields. Editing only surfaces when isRestaurant; values still
  // get sent on save so a salon→restaurant vertical change wouldn't strand
  // populated columns.
  const [ordering_links, setOrderingLinks] = useState<OrderingLink[]>(initial.ordering_links);
  const [reservations_method, setReservationsMethod] = useState<ReservationsMethod | null>(
    initial.reservations_method,
  );
  const [reservations_url, setReservationsUrl] = useState(initial.reservations_url ?? '');
  const [social_links, setSocialLinks] = useState<SocialLink[]>(initial.social_links);

  // Section labels — empty string in state = "use template default" (saved as
  // NULL on the server). Placeholder shows the current default for clarity.
  const [services_title, setServicesTitle] = useState(initial.services_title ?? '');
  const [services_eyebrow, setServicesEyebrow] = useState(initial.services_eyebrow ?? '');
  const [gallery_title, setGalleryTitle] = useState(initial.gallery_title ?? '');
  const [about_eyebrow, setAboutEyebrow] = useState(initial.about_eyebrow ?? '');

  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [sections, setSections] = useState<Section[]>(initial.sections);
  const [services, setServices] = useState<Service[]>(initial.services);

  // ── Advanced JSON editor (escape hatch) ──────────────────────────────────
  // The structured fields cover ~95% of edits. The JSON view exists for
  // power-user moves the UI doesn't yet expose: borderRadius, custom section
  // ordering, bulk service edits, etc. Drafts live here and apply to state
  // only when the operator clicks "Apply" — no implicit overwrites.
  const [draftTheme, setDraftTheme] = useState(() => JSON.stringify(initial.theme, null, 2));
  const [draftSections, setDraftSections] = useState(() => JSON.stringify(initial.sections, null, 2));
  const [draftServices, setDraftServices] = useState(() => JSON.stringify(initial.services, null, 2));
  const [draftErrors, setDraftErrors] = useState<{ theme?: string; sections?: string; services?: string }>({});

  const applyJson = (
    field: 'theme' | 'sections' | 'services',
    raw: string,
  ) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (field === 'theme') {
        if (typeof parsed !== 'object' || parsed === null) throw new Error('theme must be an object');
        setTheme(parsed as Theme);
      } else if (field === 'sections') {
        if (!Array.isArray(parsed)) throw new Error('sections must be an array');
        setSections(parsed as Section[]);
      } else {
        if (!Array.isArray(parsed)) throw new Error('services must be an array');
        setServices(parsed as Service[]);
      }
      setDraftErrors((e) => ({ ...e, [field]: undefined }));
    } catch (err) {
      setDraftErrors((e) => ({
        ...e,
        [field]: err instanceof Error ? err.message : 'invalid JSON',
      }));
    }
  };

  const resetJson = (field: 'theme' | 'sections' | 'services') => {
    if (field === 'theme') setDraftTheme(JSON.stringify(theme, null, 2));
    if (field === 'sections') setDraftSections(JSON.stringify(sections, null, 2));
    if (field === 'services') setDraftServices(JSON.stringify(services, null, 2));
    setDraftErrors((e) => ({ ...e, [field]: undefined }));
  };

  // ── Live preview: postMessage theme changes to the iframe ────────────────
  // Colors and fonts cascade through CSS variables, so the iframe can
  // live-update without reloading. style/composition/copy/services still
  // require Save (they affect React render output, not just CSS).
  const sendPreview = (current: Theme) => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    try {
      target.postMessage(
        {
          type: 'preview-theme',
          theme: {
            primary: current.primary,
            background: current.background,
            text: current.text,
            accent: current.accent,
            fontHeading: current.fontHeading,
            fontBody: current.fontBody,
            // Empty string = "remove the treatment" on the bridge side. The
            // bridge ignores undefined, so toggling treatment on/off needs an
            // explicit value here.
            background_treatment: current.background_treatment ?? '',
            // '' = clear-to-auto. Bridge re-derives from base bg in that case.
            background_alt: current.background_alt ?? '',
            // Treat undefined as on; only send false when the admin explicitly
            // toggled the switch.
            alt_bg_enabled: current.alt_bg_enabled !== false,
          },
        },
        window.location.origin,
      );
    } catch {
      // Cross-origin or detached iframe — fall through silently.
    }
  };

  // Push every theme change to the iframe. React batches setState so this
  // fires once per commit, which is fine — color picker drag → handful of
  // commits → handful of postMessages, all instant.
  useEffect(() => {
    sendPreview(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    theme.primary,
    theme.background,
    theme.text,
    theme.accent,
    theme.fontHeading,
    theme.fontBody,
    theme.background_treatment,
    theme.background_alt,
    theme.alt_bg_enabled,
  ]);

  // Live label updates — postMessage on every keystroke. PreviewBridge
  // mutates textContent on the matching `[data-label]` elements; empty
  // string falls back to the original textContent captured on iframe mount.
  const sendLabels = (labels: {
    services_title: string;
    services_eyebrow: string;
    gallery_title: string;
    about_eyebrow: string;
  }) => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    try {
      target.postMessage(
        {
          type: 'preview-labels',
          labels: {
            'services-title': labels.services_title,
            'services-eyebrow': labels.services_eyebrow,
            'gallery-title': labels.gallery_title,
            'about-eyebrow': labels.about_eyebrow,
          },
        },
        window.location.origin,
      );
    } catch {
      // Cross-origin or detached iframe — fall through silently.
    }
  };

  useEffect(() => {
    sendLabels({ services_title, services_eyebrow, gallery_title, about_eyebrow });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services_title, services_eyebrow, gallery_title, about_eyebrow]);

  // Live section toggles + reorder — bridge mutates the DOM (display:none for
  // disabled, re-appends in new order for reorder) so admins see the change
  // without a save+reload roundtrip.
  const sendSections = (current: Section[]) => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    try {
      target.postMessage(
        {
          type: 'preview-sections',
          sections: current.map((s) => ({ type: s.type, enabled: s.enabled })),
        },
        window.location.origin,
      );
    } catch {
      /* iframe gone — drop */
    }
  };

  useEffect(() => {
    sendSections(sections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  // Re-send theme + labels whenever the iframe finishes (re)loading — covers
  // the initial mount (so changes made before iframe load aren't dropped)
  // and post-save reloads (where the bridge is fresh).
  const onIframeLoad = () => {
    sendPreview(theme);
    sendLabels({ services_title, services_eyebrow, gallery_title, about_eyebrow });
    sendSections(sections);
  };

  // Bridge handshake — PreviewBridge posts "preview-bridge-ready" from inside
  // its useEffect *after* its message listener is registered. The iframe's
  // own `load` event isn't a reliable signal for that ordering (load fires
  // when the document + subresources are done, which can race ahead of
  // hydration in slow/dev builds). Without this handler, a style or services
  // composition switch reloads the iframe with the DB's stale colors and the
  // post-load postMessage gets dropped, so the preview stays on the old
  // palette until the operator nudges a color (which retriggers the
  // theme-change useEffect). Reply with the latest theme + labels here so
  // the new render always picks up the in-flight admin state.
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string } | null;
      if (data?.type !== 'preview-bridge-ready') return;
      sendPreview(theme);
      sendLabels({ services_title, services_eyebrow, gallery_title, about_eyebrow });
      sendSections(sections);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    theme.primary,
    theme.background,
    theme.text,
    theme.accent,
    theme.fontHeading,
    theme.fontBody,
    services_title,
    services_eyebrow,
    gallery_title,
    about_eyebrow,
  ]);

  // ── Composition preview: reload iframe with override params ───────────────
  // Hero / Services / Gallery composition changes which React component
  // renders, so we can't postMessage our way out of it. Debounced reload via
  // `_preview_*` params — the /sites/[host] page reads them and overrides
  // before render.
  const heroSectionIdx = sections.findIndex((s) => s.type === 'hero');
  const servicesSectionIdx = sections.findIndex((s) => s.type === 'services');
  const gallerySectionIdx = sections.findIndex((s) => s.type === 'gallery');
  const menuSectionIdx = sections.findIndex((s) => s.type === 'menu');

  const currentHeroComp =
    heroSectionIdx >= 0
      ? sections[heroSectionIdx]?.composition ?? sections[heroSectionIdx]?.variant ?? ''
      : '';
  const currentServicesComp =
    servicesSectionIdx >= 0
      ? sections[servicesSectionIdx]?.composition ?? sections[servicesSectionIdx]?.variant ?? ''
      : '';
  const currentGalleryComp =
    gallerySectionIdx >= 0
      ? sections[gallerySectionIdx]?.composition ?? sections[gallerySectionIdx]?.variant ?? ''
      : '';
  const currentMenuComp =
    menuSectionIdx >= 0
      ? sections[menuSectionIdx]?.composition ?? sections[menuSectionIdx]?.variant ?? ''
      : '';

  const [previewHeroOverride, setPreviewHeroOverride] = useState<string>(currentHeroComp);
  const [previewServicesOverride, setPreviewServicesOverride] = useState<string>(currentServicesComp);
  const [previewGalleryOverride, setPreviewGalleryOverride] = useState<string>(currentGalleryComp);
  const [previewMenuOverride, setPreviewMenuOverride] = useState<string>(currentMenuComp);
  const [previewStyleOverride, setPreviewStyleOverride] = useState<string>(theme.style);

  useEffect(() => {
    const handle = setTimeout(() => {
      setPreviewHeroOverride(currentHeroComp);
    }, 250);
    return () => clearTimeout(handle);
  }, [currentHeroComp]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setPreviewServicesOverride(currentServicesComp);
    }, 250);
    return () => clearTimeout(handle);
  }, [currentServicesComp]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setPreviewGalleryOverride(currentGalleryComp);
    }, 250);
    return () => clearTimeout(handle);
  }, [currentGalleryComp]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setPreviewMenuOverride(currentMenuComp);
    }, 250);
    return () => clearTimeout(handle);
  }, [currentMenuComp]);

  // Style changes affect React render output (component branches), so
  // postMessage CSS-var swaps aren't enough — debounced iframe reload via
  // `_preview_style=...`, mirroring the composition-override pattern.
  useEffect(() => {
    const handle = setTimeout(() => {
      setPreviewStyleOverride(theme.style);
    }, 250);
    return () => clearTimeout(handle);
  }, [theme.style]);

  // Restaurant content overrides — same debounced-reload pattern as
  // composition/style. Empty values fall through to the saved row.
  const orderingLinksKey = JSON.stringify(ordering_links);
  const [previewOrderingLinks, setPreviewOrderingLinks] = useState(orderingLinksKey);
  useEffect(() => {
    const handle = setTimeout(() => setPreviewOrderingLinks(orderingLinksKey), 250);
    return () => clearTimeout(handle);
  }, [orderingLinksKey]);

  const [previewReservationsMethod, setPreviewReservationsMethod] = useState<string>(
    reservations_method ?? '',
  );
  useEffect(() => {
    const handle = setTimeout(() => setPreviewReservationsMethod(reservations_method ?? ''), 250);
    return () => clearTimeout(handle);
  }, [reservations_method]);

  const [previewReservationsUrl, setPreviewReservationsUrl] = useState<string>(reservations_url);
  useEffect(() => {
    const handle = setTimeout(() => setPreviewReservationsUrl(reservations_url), 250);
    return () => clearTimeout(handle);
  }, [reservations_url]);

  const socialLinksKey = JSON.stringify(social_links);
  const [previewSocialLinks, setPreviewSocialLinks] = useState(socialLinksKey);
  useEffect(() => {
    const handle = setTimeout(() => setPreviewSocialLinks(socialLinksKey), 250);
    return () => clearTimeout(handle);
  }, [socialLinksKey]);

  // Build the iframe src with all current preview signals folded in.
  const iframeSrc = (() => {
    const sep = previewUrl.includes('?') ? '&' : '?';
    const parts = [`_v=${previewKey}`];
    if (previewHeroOverride) {
      parts.push(`_preview_hero=${encodeURIComponent(previewHeroOverride)}`);
    }
    if (previewServicesOverride) {
      parts.push(`_preview_services=${encodeURIComponent(previewServicesOverride)}`);
    }
    if (previewGalleryOverride) {
      parts.push(`_preview_gallery=${encodeURIComponent(previewGalleryOverride)}`);
    }
    if (previewMenuOverride) {
      parts.push(`_preview_menu=${encodeURIComponent(previewMenuOverride)}`);
    }
    if (previewStyleOverride) {
      parts.push(`_preview_style=${encodeURIComponent(previewStyleOverride)}`);
    }
    if (previewOrderingLinks && previewOrderingLinks !== '[]') {
      parts.push(`_preview_ordering_links=${encodeURIComponent(previewOrderingLinks)}`);
    }
    if (previewReservationsMethod) {
      parts.push(`_preview_reservations_method=${encodeURIComponent(previewReservationsMethod)}`);
    }
    if (previewReservationsUrl) {
      parts.push(`_preview_reservations_url=${encodeURIComponent(previewReservationsUrl)}`);
    }
    if (previewSocialLinks && previewSocialLinks !== '[]') {
      parts.push(`_preview_social_links=${encodeURIComponent(previewSocialLinks)}`);
    }
    return `${previewUrl}${sep}${parts.join('&')}`;
  })();

  const setThemeField = <K extends keyof Theme>(k: K, v: Theme[K]) =>
    setTheme((t) => ({ ...t, [k]: v }));

  // Style switch is special — it applies the new style's full signature so
  // admins switching to a flagship (or any other) style see a coherent
  // identity change, not just a CSS class swap. Replaces:
  //   1. theme.style
  //   2. palette (first preset for the new style)
  //   3. heading + body fonts (the canonical pairing for that style)
  //   4. hero + services compositions (first valid for the new style)
  // Admins can revert any individual piece via the existing dropdowns.
  const switchStyle = (newStyle: ThemeStyle) => {
    const palette = PALETTE_PRESETS[newStyle][0];
    const fonts = STYLE_DEFAULT_FONTS[newStyle];
    setTheme((t) => ({
      ...t,
      style: newStyle,
      primary: palette?.primary ?? t.primary,
      background: palette?.background ?? t.background,
      text: palette?.text ?? t.text,
      accent: palette?.accent ?? t.accent,
      fontHeading: fonts?.fontHeading ?? t.fontHeading,
      fontBody: fonts?.fontBody ?? t.fontBody,
    }));
    const signatureHero = listValidHeroCompositions(newStyle)[0];
    const signatureServices = listValidServicesCompositions(newStyle)[0];
    const signatureGallery = listValidGalleryCompositions(newStyle)[0];
    setSections((arr) =>
      arr.map((s) => {
        if (s.type === 'hero' && signatureHero) return { ...s, composition: signatureHero };
        if (s.type === 'services' && signatureServices) return { ...s, composition: signatureServices };
        if (s.type === 'gallery' && signatureGallery) return { ...s, composition: signatureGallery };
        return s;
      }),
    );
  };

  const applyPreset = (preset: (typeof PALETTE_PRESETS)[ThemeStyle][number]) => {
    setTheme((t) => ({
      ...t,
      primary: preset.primary,
      background: preset.background,
      text: preset.text,
      accent: preset.accent,
    }));
  };

  const updateSection = (idx: number, patch: Partial<Section>) =>
    setSections((arr) => arr.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  // Combine / split Order + Reservations. `dine` is a single combined section;
  // splitting restores the legacy pair so admins can embed OpenTable/Resy as
  // their own room without an ordering row crowding it. Position-preserving:
  // the new row(s) land at the position the removed row(s) occupied.
  const dineCombined = sections.some((s) => s.type === 'dine');
  const setDineCombined = (next: boolean) => {
    setSections((arr) => {
      if (next) {
        // Find first occurrence of ordering or reservations, replace pair
        // with a single dine row there.
        const idxs = arr
          .map((s, i) => (s.type === 'ordering' || s.type === 'reservations' ? i : -1))
          .filter((i) => i >= 0);
        if (idxs.length === 0) {
          // No existing rows — append a fresh dine row.
          return [...arr, { type: 'dine', enabled: true, variant: 'card' }];
        }
        const insertAt = idxs[0]!;
        const filtered = arr.filter(
          (s) => s.type !== 'ordering' && s.type !== 'reservations',
        );
        const out = [...filtered];
        out.splice(insertAt, 0, { type: 'dine', enabled: true, variant: 'card' });
        return out;
      }
      // Split: replace dine with ordering + reservations at the dine row's
      // position, in that order. (Ordering above reservations matches the
      // pre-combine convention from the generator.)
      const dineIdx = arr.findIndex((s) => s.type === 'dine');
      if (dineIdx < 0) return arr;
      const out = arr.filter((s) => s.type !== 'dine');
      out.splice(
        dineIdx,
        0,
        { type: 'ordering', enabled: true, variant: 'buttons' },
        { type: 'reservations', enabled: true, variant: reservations_method ?? 'walkin' },
      );
      return out;
    });
  };

  // Drag-to-reorder. Sections are keyed by type since each type appears at
  // most once in the list (the generate route enforces this). Hero stays at
  // the top by convention but isn't pinned in code — admins can drag it
  // anywhere if they really want, the iframe will reflect whatever order they
  // commit.
  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.type === active.id);
    const newIndex = sections.findIndex((s) => s.type === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setSections((arr) => arrayMove(arr, oldIndex, newIndex));
  };

  const heroIdx = sections.findIndex((s) => s.type === 'hero');
  const heroComp = heroIdx >= 0 ? sections[heroIdx]?.composition ?? sections[heroIdx]?.variant ?? '' : '';
  const validHeroCompositions = listValidHeroCompositions(theme.style);

  const servicesIdx = sections.findIndex((s) => s.type === 'services');
  const servicesComp =
    servicesIdx >= 0
      ? sections[servicesIdx]?.composition ?? sections[servicesIdx]?.variant ?? ''
      : '';
  const validServicesCompositions = listValidServicesCompositions(theme.style);

  const galleryIdx = sections.findIndex((s) => s.type === 'gallery');
  const galleryComp =
    galleryIdx >= 0
      ? sections[galleryIdx]?.composition ?? sections[galleryIdx]?.variant ?? ''
      : '';
  const validGalleryCompositions = listValidGalleryCompositions(theme.style);

  const menuIdx = sections.findIndex((s) => s.type === 'menu');
  const menuComp =
    menuIdx >= 0
      ? sections[menuIdx]?.composition ?? sections[menuIdx]?.variant ?? ''
      : '';
  const validMenuCompositions = listValidMenuCompositions(theme.style);

  // ── Tone-hint regeneration ────────────────────────────────────────────────
  const [toneHint, setToneHint] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenStatus, setRegenStatus] = useState<null | 'ok' | 'error'>(null);
  const [regenError, setRegenError] = useState<string | null>(null);

  const onRegenerate = async () => {
    if (toneHint.trim().length < 3) return;
    setIsRegenerating(true);
    setRegenStatus(null);
    setRegenError(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/regenerate-copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone_hint: toneHint }),
      });
      if (!res.ok) {
        setRegenStatus('error');
        try {
          const data: unknown = await res.json();
          if (data && typeof data === 'object' && 'error' in data) {
            setRegenError(String((data as { error: string }).error));
          }
        } catch {
          setRegenError(`HTTP ${res.status}`);
        }
        return;
      }

      const data = (await res.json()) as {
        copy: {
          hero: {
            headline: string;
            headline_emphasis?: string;
            subheadline: string;
            cta_text: string;
          };
          about: { title: string; body: string };
          services: { name: string; description: string; price?: string }[];
        };
      };

      // Pre-fill the form with suggestions — admin reviews + saves explicitly.
      setHeroHeadline(data.copy.hero.headline);
      setHeroEmphasis(data.copy.hero.headline_emphasis ?? '');
      setHeroSubheadline(data.copy.hero.subheadline);
      setHeroCta(data.copy.hero.cta_text);
      setAboutTitle(data.copy.about.title);
      setAboutBody(data.copy.about.body);
      setServices(data.copy.services);
      setRegenStatus('ok');
      setToneHint('');
    } catch (err) {
      setRegenStatus('error');
      setRegenError(err instanceof Error ? err.message : 'unknown');
    } finally {
      setIsRegenerating(false);
    }
  };

  const onSave = () => {
    setSaved(null);
    setErrorMsg(null);
    startTransition(async () => {
      const body = new URLSearchParams();
      body.set('_method', 'PATCH');
      body.set('hero_headline', hero_headline);
      body.set('hero_headline_emphasis', hero_headline_emphasis);
      body.set('hero_subheadline', hero_subheadline);
      body.set('hero_cta_text', hero_cta_text);
      body.set('about_title', about_title);
      body.set('about_body', about_body);
      body.set('booking_method', booking_method);
      // Only Calendly + Booksy take a URL; for phone we send empty so any
      // stale URL gets cleared on the server.
      body.set('booking_url', booking_method === 'phone' ? '' : booking_url);
      body.set('services_title', services_title);
      body.set('services_eyebrow', services_eyebrow);
      body.set('gallery_title', gallery_title);
      body.set('about_eyebrow', about_eyebrow);
      body.set('sections', JSON.stringify(sections));
      body.set('theme', JSON.stringify(theme));
      body.set('services', JSON.stringify(services));
      // Restaurant fields. Always send so toggling vertical doesn't leave
      // stale data on the row. Empty array → API stores NULL.
      body.set('ordering_links', JSON.stringify(ordering_links));
      if (reservations_method !== null) {
        body.set('reservations_method', reservations_method);
        body.set('reservations_url', reservations_url);
      }
      // Socials apply to every vertical. Empty url entries are kept in state
      // so the editor doesn't lose the platform when the customer hasn't
      // filled it in yet; rendering skips them.
      body.set('social_links', JSON.stringify(social_links));

      const res = await fetch(`/api/admin/clients/${clientId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (res.ok) {
        setSaved('ok');
        setPreviewKey((k) => k + 1);
        router.refresh();
      } else {
        setSaved('error');
        try {
          const data: unknown = await res.json();
          if (data && typeof data === 'object' && 'error' in data) {
            setErrorMsg(String((data as { error: string }).error));
          }
        } catch {
          setErrorMsg(`HTTP ${res.status}`);
        }
      }
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Editor column — narrower than the preview so the preview gets room */}
      <div className="space-y-5 xl:col-span-5">
        {/* Regenerate copy with a tone hint — pre-fills suggestions, doesn't auto-save */}
        <section className="bg-gradient-to-br from-amber-accent/8 to-amber-accent/3 rounded-2xl border border-amber-accent/30 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-accent" />
            <h2 className="font-display text-lg font-medium">Regenerate copy</h2>
          </div>
          <p className="text-xs text-ink-700 mb-3">
            Describe a tone or a specific request. The LLM rewrites hero, about,
            and services. The theme/style stays locked. Suggestions pre-fill below
            — review and Save to apply.
          </p>
          <textarea
            value={toneHint}
            onChange={(e) => setToneHint(e.target.value)}
            placeholder='e.g. "more serious tone, mention we&rsquo;re family-owned" or "shorten about to two sentences"'
            rows={3}
            disabled={isRegenerating}
            className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors mb-3 disabled:opacity-60"
            maxLength={500}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isRegenerating || toneHint.trim().length < 3}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-accent text-ink-900 rounded-full text-sm font-semibold hover:bg-amber-accent-soft disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isRegenerating && (
                <span className="inline-block w-3 h-3 border-2 border-ink-900/40 border-t-ink-900 rounded-full animate-spin" />
              )}
              {isRegenerating ? 'Generating…' : 'Generate suggestions'}
            </button>
            {regenStatus === 'ok' && !isRegenerating && (
              <span className="text-xs text-emerald-700 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                Suggestions loaded · review and save
              </span>
            )}
            {regenStatus === 'error' && !isRegenerating && (
              <span className="text-xs text-red-700">
                Regeneration failed{regenError ? `: ${regenError}` : ''}
              </span>
            )}
            <span className="text-xs text-ink-700/50 ml-auto">
              ~10s · costs ~$0.02
            </span>
          </div>
        </section>

        <Card title="Hero copy">
          <Field label="Headline">
            <input
              value={hero_headline}
              onChange={(e) => setHeroHeadline(e.target.value)}
              className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
            />
          </Field>
          <Field
            label="Italicized word"
            hint="One word from the headline that gets italicized for editorial flair. Leave blank to disable."
          >
            <input
              value={hero_headline_emphasis}
              onChange={(e) => setHeroEmphasis(e.target.value)}
              placeholder="(none)"
              className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
            />
          </Field>
          <Field label="Subheadline">
            <textarea
              value={hero_subheadline}
              onChange={(e) => setHeroSubheadline(e.target.value)}
              rows={2}
              className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
            />
          </Field>
          <Field label="CTA text">
            <input
              value={hero_cta_text}
              onChange={(e) => setHeroCta(e.target.value)}
              className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
              maxLength={20}
            />
          </Field>
        </Card>

        <Card title="Theme">
          <Field label="Style">
            <select
              value={theme.style}
              onChange={(e) => switchStyle(e.target.value as ThemeStyle)}
              className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
            >
              {STYLES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>

          <Field
            label="Palette presets"
            hint="One click swaps all four colors. Curated to look intentional for the chosen style."
          >
            <div className="flex flex-wrap gap-2">
              {PALETTE_PRESETS[theme.style].map((p) => {
                const active =
                  p.primary === theme.primary &&
                  p.background === theme.background &&
                  p.accent === theme.accent;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`group flex items-center gap-2 px-3 py-2 border rounded-lg text-xs transition-all ${
                      active
                        ? 'border-amber-accent bg-amber-accent/5'
                        : 'border-ink-900/10 hover:border-ink-900/30'
                    }`}
                  >
                    <span className="flex">
                      <Swatch color={p.background} />
                      <Swatch color={p.primary} negativeMargin />
                      <Swatch color={p.accent} negativeMargin />
                      <Swatch color={p.text} negativeMargin />
                    </span>
                    <span className="font-medium">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          <PaletteStatus theme={theme} />

          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Background" value={theme.background} onChange={(v) => setThemeField('background', v)} />
            <ColorField label="Primary" value={theme.primary} onChange={(v) => setThemeField('primary', v)} />
            <ColorField label="Text" value={theme.text} onChange={(v) => setThemeField('text', v)} />
            <ColorField label="Accent" value={theme.accent} onChange={(v) => setThemeField('accent', v)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Heading font">
              <select
                value={theme.fontHeading}
                onChange={(e) => setThemeField('fontHeading', e.target.value)}
                className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
              >
                {HEADING_FONTS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Body font">
              <select
                value={theme.fontBody}
                onChange={(e) => setThemeField('fontBody', e.target.value)}
                className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
              >
                {BODY_FONTS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field
            label="Background treatment"
            hint='Optional decorative overlay layered on top of the background color. "Mesh" / "blobs" tint with the accent color; "dot grid" gives an architectural feel; "grain" adds a subtle film texture.'
          >
            <select
              value={theme.background_treatment ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                setThemeField(
                  'background_treatment',
                  v === '' ? undefined : (v as BackgroundTreatment),
                );
              }}
              className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
            >
              <option value="">None (solid color)</option>
              <option value="mesh">Mesh — soft accent gradients</option>
              <option value="blobs">Blobs — larger organic shapes</option>
              <option value="dotgrid">Dot grid — architectural pattern</option>
              <option value="grain">Grain — film / print texture</option>
            </select>
          </Field>

          <Field
            label="Alternating section backgrounds"
            hint="Tints every other section with a sibling shade of the page background, so the boundaries between sections read clearly. Off = every section uses the base color."
          >
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={theme.alt_bg_enabled !== false}
                onChange={(e) =>
                  setThemeField('alt_bg_enabled', e.target.checked)
                }
              />
              <span>Enabled</span>
            </label>
          </Field>

          {theme.alt_bg_enabled !== false && (
            <Field
              label="Alt background color"
              hint="Leave blank to auto-derive from the base background (a ~4% tonal shift). Set a specific color to override."
            >
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={theme.background_alt ?? '#000000'}
                  onChange={(e) =>
                    setThemeField('background_alt', e.target.value)
                  }
                  className="h-9 w-12 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={theme.background_alt ?? ''}
                  placeholder="auto-derived"
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setThemeField('background_alt', v === '' ? undefined : v);
                  }}
                  className="flex-1 bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-accent transition-colors"
                />
                {theme.background_alt && (
                  <button
                    type="button"
                    onClick={() =>
                      setThemeField('background_alt', undefined)
                    }
                    className="text-xs text-ink-900/60 hover:text-ink-900 underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </Field>
          )}
        </Card>

        <Card title="Layout">
          {heroIdx >= 0 && (
            <Field
              label="Hero composition"
              hint="Hero layouts. The first options are tuned for the current style; later options work too but aren't part of the style's default mix."
            >
              <select
                value={heroComp}
                onChange={(e) => updateSection(heroIdx, { composition: e.target.value })}
                className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
              >
                {/* Always include the current value, even if not in valid list */}
                {!validHeroCompositions.includes(heroComp as never) && heroComp && (
                  <option value={heroComp}>{heroComp} (current — not in style)</option>
                )}
                {validHeroCompositions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          )}

          {servicesIdx >= 0 && !isRestaurant && (
            <Field
              label="Services composition"
              hint='Card style for the Services list — "menu-card" reads like a printed menu, "tier-cards" gives a packaged-pricing look, "numbered" is editorial.'
            >
              <select
                value={servicesComp}
                onChange={(e) => updateSection(servicesIdx, { composition: e.target.value })}
                className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
              >
                {!validServicesCompositions.includes(servicesComp as never) && servicesComp && (
                  <option value={servicesComp}>{servicesComp} (current — not in style)</option>
                )}
                {validServicesCompositions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          )}

          {menuIdx >= 0 && isRestaurant && (
            <Field
              label="Menu composition"
              hint='Layout of the menu section. "printed-menu-categorized" / "modern-stacked" / "photo-grid-menu" / "chalkboard" / "magazine-spread" render the full menu. "tabbed-menu" / "accordion-menu" / "sidebar-nav" use category filtering — best for menus with 40+ items.'
            >
              <select
                value={menuComp}
                onChange={(e) => updateSection(menuIdx, { composition: e.target.value })}
                className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
              >
                {!validMenuCompositions.includes(menuComp as never) && menuComp && (
                  <option value={menuComp}>{menuComp} (current — not in style)</option>
                )}
                {validMenuCompositions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          )}

          {galleryIdx >= 0 && (
            <Field
              label="Gallery composition"
              hint='How the photo gallery is laid out — "film-strip" is a horizontal scroll-snap contact sheet (flagship signature), "masonry" is a long photo wall, "grid" is uniform tiles.'
            >
              <select
                value={galleryComp}
                onChange={(e) => updateSection(galleryIdx, { composition: e.target.value })}
                className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
              >
                {!validGalleryCompositions.includes(galleryComp as never) && galleryComp && (
                  <option value={galleryComp}>{galleryComp} (current — not in style)</option>
                )}
                {validGalleryCompositions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Sections" hint="Drag to reorder. Toggle to enable / disable.">
            <DndContext
              sensors={sectionSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSectionDragEnd}
            >
              <SortableContext
                items={sections.map((s) => s.type)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1.5">
                  {sections.map((s, i) => (
                    <SortableSectionItem
                      key={s.type}
                      section={s}
                      onToggle={(checked) => updateSection(i, { enabled: checked })}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </Field>
        </Card>

        <Card title="Section labels">
          <p className="text-xs text-ink-700/70 -mt-2 mb-3">
            Customize the headings shown above each section. Leave blank to use
            the template default.
          </p>

          {!isRestaurant && (
            <>
              <Field
                label="Services — title"
                hint='Default: "Services"'
              >
                <input
                  value={services_title}
                  onChange={(e) => setServicesTitle(e.target.value)}
                  placeholder="Services"
                  maxLength={60}
                  className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
                />
              </Field>
              <Field
                label="Services — eyebrow"
                hint='Small line above the title. Default varies by style: "The menu" / "What we do" / blank.'
              >
                <input
                  value={services_eyebrow}
                  onChange={(e) => setServicesEyebrow(e.target.value)}
                  placeholder="(template default)"
                  maxLength={40}
                  className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
                />
              </Field>
            </>
          )}
          <Field
            label="Gallery — title"
            hint={isRestaurant ? 'Default: "From the kitchen"' : 'Default: "Our Work"'}
          >
            <input
              value={gallery_title}
              onChange={(e) => setGalleryTitle(e.target.value)}
              placeholder={isRestaurant ? 'From the kitchen' : 'Our Work'}
              maxLength={60}
              className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
            />
          </Field>
          <Field
            label="About — eyebrow"
            hint='Small line above the About title. Default: "About"'
          >
            <input
              value={about_eyebrow}
              onChange={(e) => setAboutEyebrow(e.target.value)}
              placeholder="About"
              maxLength={40}
              className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
            />
          </Field>
        </Card>

        <Card title="About">
          <Field label="Title">
            <input
              value={about_title}
              onChange={(e) => setAboutTitle(e.target.value)}
              className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
            />
          </Field>
          <Field label="Body">
            <textarea
              value={about_body}
              onChange={(e) => setAboutBody(e.target.value)}
              rows={5}
              className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
            />
          </Field>
        </Card>

        {isRestaurant && (
          <Card title="Menu">
            <p className="text-sm text-ink-700/70 -mt-2 mb-3">
              Restaurant menus live in their own editor — categories, items,
              prices, and dietary tags. The services list below is leftover
              boilerplate from generation and isn&apos;t rendered on your site.
            </p>
            <a
              href={`/admin/clients/${clientId}/menu`}
              className="inline-flex items-center gap-2 rounded-lg bg-ink-900 text-cream-50 px-4 py-2 text-sm font-medium hover:bg-ink-700 transition-colors"
            >
              Open menu editor →
            </a>
          </Card>
        )}

        {isRestaurant && (
          <Card title="Order &amp; reservations layout">
            <Field
              label="Combine into a single section"
              hint="On = one 'Dine with us' card with delivery platforms and reservations side-by-side. Off = two separate sections (useful when embedding OpenTable/Resy is the main attraction)."
            >
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dineCombined}
                  onChange={(e) => setDineCombined(e.target.checked)}
                />
                <span>Combined</span>
              </label>
              <p className="text-xs text-ink-700/70 mt-1.5">
                {dineCombined
                  ? 'Currently combined as one "Dine with us" section.'
                  : 'Currently split as separate "Ordering" and "Reservations" sections.'}
              </p>
            </Field>
          </Card>
        )}

        {isRestaurant && (
          <Card title="Reservations">
            <Field
              label="Reservation method"
              hint="What happens when someone clicks Reserve. Walk-ins shows a 'no reservations needed' notice instead of a button."
            >
              <select
                value={reservations_method ?? 'walkin'}
                onChange={(e) => setReservationsMethod(e.target.value as ReservationsMethod)}
                className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
              >
                {RESERVATION_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <p className="text-xs text-ink-700/70 mt-1.5">
                {RESERVATION_METHODS.find((m) => m.id === (reservations_method ?? 'walkin'))?.description}
              </p>
            </Field>
            {(reservations_method === 'opentable' ||
              reservations_method === 'resy' ||
              reservations_method === 'tock') && (
              <Field
                label="Reservation page URL"
                hint="Full URL of the restaurant's page on the chosen platform."
              >
                <input
                  value={reservations_url}
                  onChange={(e) => setReservationsUrl(e.target.value)}
                  placeholder={
                    reservations_method === 'opentable'
                      ? 'https://www.opentable.com/r/...'
                      : reservations_method === 'resy'
                      ? 'https://resy.com/cities/.../...'
                      : 'https://www.exploretock.com/...'
                  }
                  className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
                />
              </Field>
            )}
          </Card>
        )}

        {isRestaurant && (
          <Card title="Delivery & ordering">
            <p className="text-sm text-ink-700/70 -mt-2 mb-3">
              Branded buttons that link out to delivery / takeout platforms.
              Only platforms you add a URL for appear on the site. The section
              hides entirely when the list is empty.
            </p>
            <div className="space-y-2">
              {ordering_links.map((link, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={link.platform}
                    onChange={(e) =>
                      setOrderingLinks((arr) =>
                        arr.map((x, idx) =>
                          idx === i ? { ...x, platform: e.target.value as OrderingPlatform } : x,
                        ),
                      )
                    }
                    className="bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
                  >
                    {ORDERING_PLATFORMS.map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                  <input
                    type="url"
                    value={link.url}
                    onChange={(e) =>
                      setOrderingLinks((arr) =>
                        arr.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)),
                      )
                    }
                    placeholder="https://..."
                    className="flex-1 bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setOrderingLinks((arr) => arr.filter((_, idx) => idx !== i))
                    }
                    className="text-xs text-red-700 hover:text-red-900 px-2 py-1"
                    aria-label="Remove link"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setOrderingLinks((arr) => [...arr, { platform: 'doordash', url: '' }])
                }
                className="w-full border border-dashed border-ink-900/15 rounded-lg py-2 text-sm text-ink-700 hover:border-amber-accent hover:text-amber-accent transition-colors"
              >
                + Add link
              </button>
            </div>
          </Card>
        )}

        <Card title="Social links">
          <p className="text-sm text-ink-700/70 -mt-2 mb-3">
            Icons in the site footer and Follow section. The Follow section
            shows every platform as a preview button; empty URLs render as
            non-clickable placeholders. The footer hides empty entries.
          </p>
          <div className="space-y-2">
            {social_links.map((link, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={link.platform}
                  onChange={(e) =>
                    setSocialLinks((arr) =>
                      arr.map((x, idx) =>
                        idx === i ? { ...x, platform: e.target.value as SocialPlatform } : x,
                      ),
                    )
                  }
                  className="bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
                >
                  {SOCIAL_PLATFORMS_LIST.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
                <input
                  type="url"
                  value={link.url}
                  onChange={(e) =>
                    setSocialLinks((arr) =>
                      arr.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)),
                    )
                  }
                  placeholder={
                    SOCIAL_PLATFORMS_LIST.find((p) => p.id === link.platform)?.placeholder ?? 'https://...'
                  }
                  className="flex-1 bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() =>
                    setSocialLinks((arr) => arr.filter((_, idx) => idx !== i))
                  }
                  className="text-xs text-red-700 hover:text-red-900 px-2 py-1"
                  aria-label="Remove link"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setSocialLinks((arr) => [...arr, { platform: 'facebook', url: '' }])
              }
              className="w-full border border-dashed border-ink-900/15 rounded-lg py-2 text-sm text-ink-700 hover:border-amber-accent hover:text-amber-accent transition-colors"
            >
              + Add link
            </button>
          </div>
        </Card>

        {!isRestaurant && (
        <Card title={`Services (${services.length})`}>
          <div className="space-y-3">
            {services.map((s, i) => (
              <div
                key={i}
                className="border border-ink-900/10 rounded-lg p-3 space-y-2 bg-cream-50/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-ink-700/60 font-semibold">
                    Service {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (services.length <= 2) return;
                      setServices((arr) => arr.filter((_, idx) => idx !== i));
                    }}
                    disabled={services.length <= 2}
                    className="text-xs text-red-700 hover:text-red-900 disabled:text-ink-700/30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Remove service"
                  >
                    Remove
                  </button>
                </div>
                <input
                  value={s.name}
                  onChange={(e) =>
                    setServices((arr) =>
                      arr.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)),
                    )
                  }
                  placeholder="Service name"
                  maxLength={50}
                  className="w-full bg-white border border-ink-900/10 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-amber-accent transition-colors"
                />
                <textarea
                  value={s.description}
                  onChange={(e) =>
                    setServices((arr) =>
                      arr.map((x, idx) => (idx === i ? { ...x, description: e.target.value } : x)),
                    )
                  }
                  placeholder="What's included…"
                  rows={2}
                  maxLength={200}
                  className="w-full bg-white border border-ink-900/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-accent transition-colors"
                />
                <input
                  value={s.price ?? ''}
                  onChange={(e) =>
                    setServices((arr) =>
                      arr.map((x, idx) =>
                        idx === i
                          ? { ...x, price: e.target.value === '' ? undefined : e.target.value }
                          : x,
                      ),
                    )
                  }
                  placeholder='Price (optional, e.g. "$45" or "From $80")'
                  maxLength={40}
                  className="w-full bg-white border border-ink-900/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-accent transition-colors"
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                if (services.length >= 8) return;
                setServices((arr) => [
                  ...arr,
                  { name: 'New service', description: '' },
                ]);
              }}
              disabled={services.length >= 8}
              className="w-full border border-dashed border-ink-900/15 rounded-lg py-2 text-sm text-ink-700 hover:border-amber-accent hover:text-amber-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              + Add service {services.length >= 8 && '(max 8)'}
            </button>
          </div>
        </Card>
        )}

        {!isRestaurant && (
        <Card title="Booking">
          <Field
            label="What does Book Now do?"
            hint="Pick how visitors book. Calendly embeds inline; Booksy opens in a new tab; Phone triggers a tap-to-call."
          >
            <div className="space-y-2">
              <BookingMethodOption
                value="calendly"
                checked={booking_method === 'calendly'}
                onChange={setBookingMethod}
                label="Calendly"
                description="Embedded scheduler. Themed to match the site."
              />
              <BookingMethodOption
                value="booksy"
                checked={booking_method === 'booksy'}
                onChange={setBookingMethod}
                label="Booksy"
                description="Booksy blocks iframing, so this opens in a new tab."
              />
              {isBarbershop && (
                <BookingMethodOption
                  value="cuts"
                  checked={booking_method === 'cuts'}
                  onChange={setBookingMethod}
                  label="The Cut"
                  description="Deep-links to the barber's profile on the Cuts app. Opens in a new tab."
                />
              )}
              <BookingMethodOption
                value="phone"
                checked={booking_method === 'phone'}
                onChange={setBookingMethod}
                label="Phone call"
                description="Book Now triggers a tap-to-call to the business phone."
              />
            </div>
          </Field>

          {booking_method === 'calendly' && (
            <Field
              label="Calendly URL"
              hint="Full URL, e.g. https://calendly.com/yourname/30min. Leave blank on unclaimed sites to show the Stoopcraft demo; on claimed sites blank hides the booking section."
            >
              <input
                value={booking_url}
                onChange={(e) => setBookingUrl(e.target.value)}
                placeholder="https://calendly.com/yourname/30min"
                className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
              />
            </Field>
          )}

          {booking_method === 'booksy' && (
            <Field
              label="Booksy profile URL"
              hint="Paste the full URL of the business's Booksy page (e.g. https://booksy.com/en_us/12345_business-name)."
            >
              <input
                value={booking_url}
                onChange={(e) => setBookingUrl(e.target.value)}
                placeholder="https://booksy.com/en_us/…"
                className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
              />
            </Field>
          )}

          {booking_method === 'cuts' && (
            <Field
              label="The Cut profile URL"
              hint="Paste the full URL of the barber's profile on The Cut (e.g. https://app.thecut.co/barbers/their-handle)."
            >
              <input
                value={booking_url}
                onChange={(e) => setBookingUrl(e.target.value)}
                placeholder="https://app.thecut.co/barbers/…"
                className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-accent transition-colors"
              />
            </Field>
          )}

          {booking_method === 'phone' && (
            <p className="text-xs text-ink-700/70">
              Uses the client&rsquo;s business phone number. Set it on the
              client detail page if it&rsquo;s missing — otherwise the booking
              section is suppressed entirely.
            </p>
          )}
        </Card>
        )}

        {/* Advanced JSON editor — escape hatch for power-user moves the
            structured UI doesn't expose (borderRadius, custom variants,
            bulk service edits, etc.). Closed by default. */}
        <details className="bg-white rounded-2xl border border-ink-900/10 shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden group">
          <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer hover:bg-cream-50/50 transition-colors list-none">
            <span className="flex items-center gap-2">
              <span className="font-display text-lg font-medium">Advanced (JSON)</span>
              <span className="text-xs text-ink-700/60 font-normal">escape hatch</span>
            </span>
            <span className="text-ink-700/50 text-sm transition-transform group-open:rotate-90">›</span>
          </summary>

          <div className="px-5 pb-5 space-y-5 border-t border-ink-900/5">
            <p className="text-xs text-ink-700/70 pt-4">
              Drafts here only apply to the form when you click Apply. The
              normal Save button below still pushes everything to the DB.
              Use this for fields the structured UI doesn&rsquo;t cover yet:
              theme.borderRadius, custom section ordering, raw service edits.
            </p>

            <JsonField
              label="Theme"
              draft={draftTheme}
              onDraftChange={setDraftTheme}
              onApply={() => applyJson('theme', draftTheme)}
              onReset={() => resetJson('theme')}
              error={draftErrors.theme}
            />
            <JsonField
              label="Sections"
              draft={draftSections}
              onDraftChange={setDraftSections}
              onApply={() => applyJson('sections', draftSections)}
              onReset={() => resetJson('sections')}
              error={draftErrors.sections}
            />
            <JsonField
              label="Services"
              draft={draftServices}
              onDraftChange={setDraftServices}
              onApply={() => applyJson('services', draftServices)}
              onReset={() => resetJson('services')}
              error={draftErrors.services}
            />
          </div>
        </details>

        {/* Sticky save bar */}
        <div className="sticky bottom-0 -mx-1 px-1 py-3 bg-cream-50/95 backdrop-blur-sm border-t border-ink-900/10 flex items-center gap-3 z-10">
          <button
            type="button"
            onClick={onSave}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink-900 text-cream-50 rounded-full text-sm font-semibold hover:bg-ink-800 disabled:opacity-50 transition-all"
          >
            {isPending ? 'Saving…' : 'Save + Revalidate'}
          </button>
          {saved === 'ok' && !isPending && (
            <span className="text-sm text-emerald-700 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Saved · preview reloaded
            </span>
          )}
          {saved === 'error' && !isPending && (
            <span className="text-sm text-red-700">
              Save failed{errorMsg ? `: ${errorMsg}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Preview column — gets the larger 7/12 share so the iframe has room */}
      <div className="xl:col-span-7 xl:sticky xl:top-4 xl:h-[calc(100vh-3rem)]">
        <div className="flex items-center justify-between mb-2 gap-3">
          <h2 className="text-sm font-semibold text-ink-700">Live preview</h2>
          <div className="flex items-center gap-3">
            <DevicePicker value={previewDevice} onChange={setPreviewDevice} />
            <button
              type="button"
              onClick={() => setPreviewMaximized(true)}
              aria-label="Maximize preview"
              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-ink-700/60 hover:text-ink-900 hover:bg-ink-900/5 transition-colors"
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4" />
              </svg>
            </button>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-accent hover:underline"
            >
              Open in tab ↗
            </a>
          </div>
        </div>
        {/* Wrapper sets the visual height; DevicePreview fills it. Hidden
            (but mounted) when maximized so the column doesn't reflow — the
            single iframe instance moves into the overlay below. */}
        <div
          className={previewMaximized ? 'invisible' : ''}
          style={{ height: 'calc(100vh - 7rem)', minHeight: 600 }}
        >
          {!previewMaximized && (
            <DevicePreview
              frameRef={previewFrameRef}
              iframeRef={iframeRef}
              src={iframeSrc}
              onLoad={onIframeLoad}
              device={previewDevice}
              containerWidth={previewContainerWidth}
            />
          )}
        </div>
        <p className="text-[11px] text-ink-700/60 mt-2 leading-relaxed">
          <span className="text-emerald-700">Live:</span> style, colors, fonts,
          palette presets, hero composition, services composition, section labels.{' '}
          <span className="text-amber-accent">Save to see:</span> copy, services
          list edits, section toggles.
        </p>
      </div>

      {previewMaximized && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/55 backdrop-blur-sm flex flex-col p-5 gap-3"
          role="dialog"
          aria-modal="true"
          aria-label="Maximized site preview"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white/90">Live preview</h2>
            <div className="flex items-center gap-3">
              <DevicePicker value={previewDevice} onChange={setPreviewDevice} />
              <button
                type="button"
                onClick={() => setPreviewMaximized(false)}
                aria-label="Close maximized preview"
                className="inline-flex items-center gap-2 px-3 h-7 rounded-full text-xs text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
                Close <span className="opacity-60">Esc</span>
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <DevicePreview
              frameRef={fullscreenFrameRef}
              iframeRef={iframeRef}
              src={iframeSrc}
              onLoad={onIframeLoad}
              device={previewDevice}
              containerWidth={fullscreenContainerWidth}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

// Device viewport widths for the preview iframe. Desktop is rendered at a
// real desktop width and scaled down to fit the (typically narrow) preview
// column, so what you see reflects actual layout breakpoints, not a squished
// version of them.
const DEVICE_WIDTHS: Record<'mobile' | 'desktop', number> = {
  mobile: 390,
  desktop: 1280,
};

function DevicePicker({
  value,
  onChange,
}: {
  value: 'mobile' | 'desktop';
  onChange: (v: 'mobile' | 'desktop') => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Preview device"
      className="inline-flex items-center bg-ink-900/5 rounded-full p-0.5 border border-ink-900/10"
    >
      <DeviceButton active={value === 'desktop'} onClick={() => onChange('desktop')} label="Desktop">
        <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
          <path d="M7 16.5h6M10 13.5v3" strokeLinecap="round" />
        </svg>
      </DeviceButton>
      <DeviceButton active={value === 'mobile'} onClick={() => onChange('mobile')} label="Mobile">
        <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="6" y="2.5" width="8" height="15" rx="1.6" />
          <path d="M9 15h2" strokeLinecap="round" />
        </svg>
      </DeviceButton>
    </div>
  );
}

function DeviceButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
        active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-700/60 hover:text-ink-900'
      }`}
    >
      {children}
    </button>
  );
}

function DevicePreview({
  frameRef,
  iframeRef,
  src,
  onLoad,
  device,
  containerWidth,
}: {
  frameRef: React.RefObject<HTMLDivElement | null>;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  src: string;
  onLoad: () => void;
  device: 'mobile' | 'desktop';
  containerWidth: number;
}) {
  const targetWidth = DEVICE_WIDTHS[device];
  // Desktop: scale down to fit the column, but never scale up past 1 — large
  // columns just show the iframe at native 1280 anchored left, with empty
  // space to the right. Avoid scaling up; it makes content look zoomed.
  // Mobile: never scale up either; if the column is wider than 390 we keep
  // it at native width and center.
  const measured = containerWidth > 0;
  const scale = measured ? Math.min(1, containerWidth / targetWidth) : 1;
  const iframeLogicalHeight = scale > 0 && scale < 1 ? `${100 / scale}%` : '100%';

  // Mobile centers in the column; desktop anchors left so we never get the
  // "cut off, seems centered" perception when the column is wider than 1280.
  const justify = device === 'mobile' ? 'justify-center' : 'justify-start';

  return (
    <div
      ref={frameRef}
      className={`w-full h-full bg-ink-900/5 rounded-2xl border border-ink-900/10 overflow-hidden flex ${justify}`}
    >
      {/* Wait for first measurement before painting the iframe — eliminates
          the unscaled-overflow flash entirely. */}
      {measured && (
        <div
          style={{
            width: targetWidth * scale,
            height: '100%',
            padding: device === 'mobile' ? '12px 0' : 0,
            flexShrink: 0,
          }}
        >
          <iframe
            ref={iframeRef}
            src={src}
            onLoad={onLoad}
            title="Site preview"
            className="bg-cream-50 border border-ink-900/10 shadow-sm block"
            style={{
              width: targetWidth,
              height: iframeLogicalHeight,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              borderRadius: device === 'mobile' ? 22 : 12,
            }}
          />
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-ink-900/10 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <h2 className="font-display text-lg font-medium mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-700 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-700/70 mt-1.5">{hint}</p>}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-700 mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2 border border-ink-900/10 rounded-lg pl-1.5 pr-3 py-1.5 focus-within:border-amber-accent transition-colors bg-cream-50">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-md cursor-pointer border-0 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-sm font-mono focus:outline-none"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Custom palette status — WCAG contrast warning + "using custom" badge
//
// Shows when the four colors don't match any preset for the current style
// (admin/customer hand-edited at least one), and warns when text/background
// contrast falls below WCAG AA (4.5:1 for body text).
// ============================================================================
function PaletteStatus({ theme }: { theme: Theme }) {
  const matchesPreset = PALETTE_PRESETS[theme.style].some(
    (p) =>
      p.background === theme.background &&
      p.primary === theme.primary &&
      p.text === theme.text &&
      p.accent === theme.accent,
  );
  const contrast = contrastRatio(theme.text, theme.background);
  const passesAA = contrast >= 4.5;
  const passesAALarge = contrast >= 3;

  if (matchesPreset && passesAA) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {!matchesPreset && (
        <span className="px-2 py-0.5 rounded-full bg-ink-900/5 border border-ink-900/10 font-medium">
          Custom palette
        </span>
      )}
      {!passesAA && (
        <span
          className={`px-2 py-0.5 rounded-full border font-medium ${
            passesAALarge
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {passesAALarge
            ? `Contrast ${contrast.toFixed(1)}:1 — passes for large text only`
            : `Low contrast (${contrast.toFixed(1)}:1) — text may be hard to read`}
        </span>
      )}
    </div>
  );
}

function relativeLuminance(hex: string): number {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return 0;
  const channel = (start: number) => {
    const v = parseInt(cleaned.slice(start, start + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

function BookingMethodOption({
  value,
  checked,
  onChange,
  label,
  description,
}: {
  value: BookingMethod;
  checked: boolean;
  onChange: (v: BookingMethod) => void;
  label: string;
  description: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-colors ${
        checked
          ? 'border-amber-accent bg-amber-accent/5'
          : 'border-ink-900/10 hover:border-ink-900/30'
      }`}
    >
      <input
        type="radio"
        name="booking_method"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="accent-amber-accent w-4 h-4 mt-0.5 shrink-0"
      />
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-ink-700/70 mt-0.5">{description}</span>
      </span>
    </label>
  );
}

function Swatch({
  color,
  negativeMargin,
}: {
  color: string;
  negativeMargin?: boolean;
}) {
  return (
    <span
      className={`block w-4 h-4 rounded-full border border-white shadow-sm ${negativeMargin ? '-ml-1.5' : ''}`}
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}

function JsonField({
  label,
  draft,
  onDraftChange,
  onApply,
  onReset,
  error,
}: {
  label: string;
  draft: string;
  onDraftChange: (v: string) => void;
  onApply: () => void;
  onReset: () => void;
  error?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-ink-700">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-ink-700 hover:text-ink-900 transition-colors"
          >
            Reset to current
          </button>
          <button
            type="button"
            onClick={onApply}
            className="text-xs bg-ink-900 text-cream-50 px-3 py-1 rounded-md font-medium hover:bg-ink-800 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
      <textarea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        rows={Math.min(20, Math.max(6, draft.split('\n').length))}
        spellCheck={false}
        className="w-full bg-cream-50 border border-ink-900/10 rounded-lg px-3 py-2 text-xs font-mono leading-relaxed focus:outline-none focus:border-amber-accent transition-colors"
      />
      {error && (
        <p className="text-xs text-red-700 mt-1.5">Parse error: {error}</p>
      )}
    </div>
  );
}


function SortableSectionItem({
  section,
  onToggle,
}: {
  section: Section;
  onToggle: (checked: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.type });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-2 border border-ink-900/10 rounded-lg bg-white"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="px-1.5 text-ink-700 hover:text-ink-900 cursor-grab active:cursor-grabbing select-none"
      >
        ⋮⋮
      </button>
      <label className="flex flex-1 items-center justify-between gap-3 cursor-pointer">
        <span className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={section.enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="accent-amber-accent w-4 h-4"
          />
          <span className="text-sm font-medium capitalize">{section.type}</span>
        </span>
        <span className="text-xs text-ink-700">{section.composition ?? section.variant}</span>
      </label>
    </div>
  );
}
