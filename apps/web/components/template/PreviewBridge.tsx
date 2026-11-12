'use client';

import { useEffect } from 'react';
import { composeBackground } from '@/lib/theme/background';
import type { BackgroundTreatment } from '@dfy/db';

// Mirrors deriveAltBg in lib/theme/altBg. Inlined for the same reason as
// isDarkBackground — client component, can't pull server-tinted modules.
function deriveAltBg(hex: string): string | null {
  const cleaned = hex.replace('#', '');
  const expanded =
    cleaned.length === 3
      ? cleaned.split('').map((c) => c + c).join('')
      : cleaned.length >= 6
        ? cleaned.slice(0, 6)
        : '';
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const delta = luma < 0.5 ? 10 : -10;
  const shift = (c: number) => Math.max(0, Math.min(255, c + delta));
  const out = [shift(r), shift(g), shift(b)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('');
  return `#${out}`;
}

// Mirrors isDarkBackground in lib/tenant. Inlined because lib/tenant pulls in
// server-only Supabase clients via next/headers and can't be imported from a
// client component. Pure 12-line helper — duplication is the lighter cost.
function isDarkBackground(hex: string): boolean {
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

// ============================================================================
// PreviewBridge
//
// Mounted inside customer sites. Listens for postMessage from a parent admin
// dashboard frame and live-updates theme CSS variables so the operator sees
// color/font changes instantly without saving + reloading.
//
// Only runs when the page is iframed by a same-origin parent. Safe no-op for
// public visitors (no parent → no messages → nothing happens).
//
// What this CAN live-update: colors, fonts, border radius — anything that
// flows through CSS variables.
// What this CAN'T live-update: theme.style, section composition, copy, photos.
// Those affect React render output, which is fixed at SSR time. Save +
// reload is required for those.
// ============================================================================

const FONT_SPECS: Record<string, string> = {
  'Playfair Display': 'Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600',
  Fraunces: 'Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500',
  'Cormorant Garamond': 'Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500',
  Inter: 'Inter:wght@400;500;600;700',
  Merriweather: 'Merriweather:ital,wght@0,400;0,700;1,400',
  'Bebas Neue': 'Bebas+Neue',
  Poppins: 'Poppins:wght@400;500;600;700',
  'Space Grotesk': 'Space+Grotesk:wght@400;500;600;700',
  Lora: 'Lora:ital,wght@0,400;0,500;0,600;1,400',
  'Open Sans': 'Open+Sans:wght@400;600;700',
  Roboto: 'Roboto:wght@400;500;700',
  'DM Sans': 'DM+Sans:wght@400;500;600;700',
};

type ThemePreview = {
  primary?: string;
  background?: string;
  text?: string;
  accent?: string;
  fontHeading?: string;
  fontBody?: string;
  // '' means "remove the treatment". null/undefined means "no change."
  background_treatment?: BackgroundTreatment | '';
  // '' means "clear back to the auto-derived shade". null/undefined = no change.
  background_alt?: string;
  // null/undefined = no change. Booleans toggle the alt-bg effect — when
  // false, every wrapper marked data-section-alt="1" stops applying its
  // --section-bg override so all sections revert to the base bg.
  alt_bg_enabled?: boolean;
};

// Label keys mirror the data-label attribute names sprinkled across the
// section components. Empty string from the editor means "use template
// default", which we restore from the textContent we captured on mount.
type LabelsPreview = {
  'services-title'?: string;
  'services-eyebrow'?: string;
  'gallery-title'?: string;
  'about-eyebrow'?: string;
};

function ensureFontLoaded(fontName: string) {
  const spec = FONT_SPECS[fontName];
  if (!spec) return;
  // Don't double-load — Google Fonts are heavy and we don't want layout shift
  // every time the operator clicks a different font.
  const existing = document.querySelector(
    `link[data-preview-font="${fontName}"]`,
  );
  if (existing) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  link.dataset.previewFont = fontName;
  document.head.appendChild(link);
}

export function PreviewBridge() {
  useEffect(() => {
    // Capture the originally-rendered text for every labeled element on
    // mount so the editor can "clear" a field and we restore the template
    // default. Map: data-label key → original textContent.
    const originals = new Map<string, string>();
    document.querySelectorAll<HTMLElement>('[data-label]').forEach((el) => {
      const key = el.getAttribute('data-label');
      if (key && !originals.has(key)) {
        originals.set(key, el.textContent ?? '');
      }
    });

    const applyLabels = (labels: LabelsPreview) => {
      (Object.entries(labels) as [keyof LabelsPreview, string | undefined][]).forEach(
        ([key, raw]) => {
          if (raw === undefined) return;
          const value = raw.trim() === '' ? originals.get(key) ?? '' : raw;
          document
            .querySelectorAll<HTMLElement>(`[data-label="${key}"]`)
            .forEach((el) => {
              el.textContent = value;
            });
        },
      );
    };

    const applyTheme = (theme: ThemePreview) => {
      const root = document.querySelector<HTMLElement>('main.dfy-site');
      if (!root) return;
      if (theme.primary) root.style.setProperty('--color-primary', theme.primary);

      // Treatment + bg-color compose into a single --color-background value.
      // Either side can change independently:
      //   - palette switch  → bg-color changes, treatment stays
      //   - treatment toggle → treatment changes, bg-color stays
      // We always read the *other* side from the data-attrs we keep in sync.
      const treatmentChange = theme.background_treatment !== undefined;
      const bgChange = theme.background !== undefined;
      if (treatmentChange) {
        root.dataset.bgTreatment = theme.background_treatment ?? '';
      }
      if (bgChange) {
        root.dataset.bgColor = theme.background!;
      }
      if (treatmentChange || bgChange) {
        const bgColor = root.dataset.bgColor ?? '#ffffff';
        const t = root.dataset.bgTreatment;
        const treatment = t && t !== '' ? (t as BackgroundTreatment) : null;
        root.style.setProperty('--color-background', composeBackground(bgColor, treatment));
      }
      if (bgChange) {
        // --color-background-alt tracks the base bg when no explicit alt is
        // set. The next preview-theme payload that carries background_alt will
        // overwrite this (the editor batches both into the same postMessage
        // when commits coincide), so the explicit color wins.
        if (root.dataset.bgAltExplicit !== '1') {
          const alt = deriveAltBg(theme.background!);
          if (alt) root.style.setProperty('--color-background-alt', alt);
        }
        // --card-surface / --card-ring are SSR'd off bg luminance — recompute
        // them here so palette switches that flip light↔dark (e.g. service-tech
        // Cream/Blue → Navy/Electric) update the cards live without an iframe
        // reload. Without this, the cards stay on their SSR-baked white
        // surface and white --color-text becomes invisible.
        const onDark = isDarkBackground(theme.background!);
        root.style.setProperty(
          '--card-surface',
          onDark ? 'color-mix(in srgb, var(--color-text) 5%, transparent)' : '#ffffff',
        );
        root.style.setProperty(
          '--card-ring',
          onDark ? 'color-mix(in srgb, var(--color-text) 12%, transparent)' : 'rgba(0,0,0,0.06)',
        );
      }
      if (theme.text) root.style.setProperty('--color-text', theme.text);
      if (theme.accent) root.style.setProperty('--color-accent', theme.accent);

      // Alt section bg — root carries --color-background-alt; wrappers read
      // it through --section-bg. Empty string clears back to "auto-derived"
      // (we recompute the shade off the current base bg).
      if (theme.background_alt !== undefined) {
        const value = theme.background_alt;
        const baseBg = root.dataset.bgColor ?? '#ffffff';
        if (value === '') {
          root.dataset.bgAltExplicit = '0';
          const derived = deriveAltBg(baseBg) ?? baseBg;
          root.style.setProperty('--color-background-alt', derived);
        } else {
          root.dataset.bgAltExplicit = '1';
          root.style.setProperty('--color-background-alt', value);
        }
      }

      // Alt-bg master switch: toggle every wrapper that was SSR-tagged as
      // an alt section. We only touch the wrappers (data-section-alt="1");
      // base-bg wrappers stay untouched.
      if (theme.alt_bg_enabled !== undefined) {
        root.dataset.altBgEnabled = theme.alt_bg_enabled ? '1' : '0';
        document
          .querySelectorAll<HTMLElement>('[data-section-alt="1"]')
          .forEach((el) => {
            if (theme.alt_bg_enabled) {
              el.style.setProperty('--section-bg', 'var(--color-background-alt)');
            } else {
              el.style.removeProperty('--section-bg');
            }
          });
      }
      if (theme.fontHeading) {
        root.style.setProperty('--font-heading', theme.fontHeading);
        ensureFontLoaded(theme.fontHeading);
      }
      if (theme.fontBody) {
        root.style.setProperty('--font-body', theme.fontBody);
        ensureFontLoaded(theme.fontBody);
      }
    };

    // Sections render with stable ids (anchored by hash links). Most match
    // section.type 1:1, but two are aliased — keep this in sync with the
    // outermost <section id="..."> in each section component.
    const SECTION_ID_BY_TYPE: Record<string, string> = {
      hero: 'home',
      ordering: 'order',
    };
    const sectionIdFor = (type: string): string =>
      SECTION_ID_BY_TYPE[type] ?? type;

    // Mirrors the restaurant nav-link logic in Nav.tsx so live toggles also
    // hide/show the matching nav links — admin disables Reservations and the
    // link disappears from the nav strip the same beat the section vanishes.
    //
    // We deliberately only touch `display` here; physically moving DOM nodes
    // (insertBefore / appendChild) collides with React's reconciler — once
    // any other React state changes inside the iframe (e.g. the menu
    // lightbox opening), `removeChild` throws because React expects the
    // tree it last rendered. Reorder still applies on save+reload via the
    // server-rendered output, which is the only path that's safe.
    const applySections = (sectionsList: { type: string; enabled: boolean }[]) => {
      const root = document.querySelector<HTMLElement>('main.dfy-site');
      if (!root) return;

      // Hide / show sections.
      for (const s of sectionsList) {
        const el = document.getElementById(sectionIdFor(s.type));
        if (!el) continue;
        el.style.display = s.enabled ? '' : 'none';
      }

      // Restaurant nav links match #section-anchors. When a section is
      // disabled, hide its link so the nav strip stays consistent with what
      // actually scrolls into view.
      const disabledHrefs = new Set(
        sectionsList
          .filter((s) => !s.enabled)
          .map((s) => `#${sectionIdFor(s.type)}`),
      );
      document
        .querySelectorAll<HTMLAnchorElement>('header.dfy-nav a[href^="#"]')
        .forEach((a) => {
          a.style.display = disabledHrefs.has(a.getAttribute('href') ?? '')
            ? 'none'
            : '';
        });
    };

    const handler = (e: MessageEvent) => {
      // Same-origin only. Customer sites in production don't receive these
      // messages because the admin dashboard sits at the platform apex,
      // which is the only origin that gets through `'self'` frame-ancestors.
      if (e.origin !== window.location.origin) return;
      const data = e.data as
        | {
            type?: string;
            theme?: ThemePreview;
            labels?: LabelsPreview;
            sections?: { type: string; enabled: boolean }[];
          }
        | null;
      if (!data) return;
      if (data.type === 'preview-theme' && data.theme) applyTheme(data.theme);
      if (data.type === 'preview-labels' && data.labels) applyLabels(data.labels);
      if (data.type === 'preview-sections' && Array.isArray(data.sections)) {
        applySections(data.sections);
      }
    };

    window.addEventListener('message', handler);
    // Tell the parent the bridge is ready in case it postMessaged early.
    try {
      window.parent?.postMessage(
        { type: 'preview-bridge-ready' },
        window.location.origin,
      );
    } catch {
      // No parent or cross-origin — fine, we just listen.
    }
    return () => window.removeEventListener('message', handler);
  }, []);

  return null;
}
