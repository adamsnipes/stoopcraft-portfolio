import { describe, it, expect } from 'vitest';
import { PALETTE_PRESETS } from '../../apps/web/lib/content-gen/palettes';
import {
  pickCompositions,
  listValidHeroCompositions,
  listValidServicesCompositions,
  listValidGalleryCompositions,
  type PickerSignals,
} from '../../apps/web/lib/content-gen/compositions';
import { parseTheme } from '../../apps/web/lib/tenant';
import type { ThemeStyle } from '@dfy/db';

// ============================================================================
// Cross-file ThemeStyle coverage.
//
// `ThemeStyle` is the primary identity axis and it's referenced from several
// maps that MUST stay in sync. Adding a new style without adding it to even
// one of these silently degrades the user experience — most visibly,
// parseTheme falls back to 'editorial' when the new style isn't allow-listed,
// so the customer's site quietly renders the wrong identity with no error.
//
// This test takes PALETTE_PRESETS as the canonical list (every shipped style
// must have at least one palette) and asserts every downstream map covers it.
// ============================================================================

const STYLE_KEYS = Object.keys(PALETTE_PRESETS) as ThemeStyle[];

const baseSignals: PickerSignals = {
  photoCount: 8,
  hasLandscape: true,
  hasPortrait: true,
  headlineWords: 5,
  serviceCount: 4,
  hash: 0,
};

describe('ThemeStyle coverage — every shipped style is registered everywhere', () => {
  it('PALETTE_PRESETS has at least one canonical entry', () => {
    expect(STYLE_KEYS.length).toBeGreaterThan(0);
    for (const style of STYLE_KEYS) {
      expect(PALETTE_PRESETS[style]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it.each(STYLE_KEYS)('parseTheme round-trips style %s (catches missing VALID_STYLES entry)', (style) => {
    const theme = parseTheme({
      primary: '#000000',
      background: '#ffffff',
      text: '#111111',
      accent: '#888888',
      fontHeading: 'Inter',
      fontBody: 'Inter',
      borderRadius: '0.5rem',
      style,
    });
    expect(theme.style).toBe(style);
  });

  it.each(STYLE_KEYS)('listValidHeroCompositions returns >=1 entry for %s', (style) => {
    expect(listValidHeroCompositions(style).length).toBeGreaterThan(0);
  });

  it.each(STYLE_KEYS)('listValidServicesCompositions returns >=1 entry for %s', (style) => {
    expect(listValidServicesCompositions(style).length).toBeGreaterThan(0);
  });

  it.each(STYLE_KEYS)('listValidGalleryCompositions returns >=1 entry for %s', (style) => {
    expect(listValidGalleryCompositions(style).length).toBeGreaterThan(0);
  });

  it.each(STYLE_KEYS)('pickCompositions succeeds for %s with rich signals', (style) => {
    const result = pickCompositions(style, baseSignals);
    expect(result.hero).toBeTruthy();
    expect(result.services).toBeTruthy();
    expect(result.about).toBeTruthy();
    expect(result.gallery).toBeTruthy();
  });

  it.each(STYLE_KEYS)('pickCompositions succeeds for %s with bare signals (no photos)', (style) => {
    const result = pickCompositions(style, {
      ...baseSignals,
      photoCount: 0,
      hasLandscape: false,
      hasPortrait: false,
    });
    expect(result.hero).toBeTruthy();
    expect(result.services).toBeTruthy();
  });
});

describe('Flagship-tier degradation', () => {
  it('flagship-atelier degrades services to editorial when photo bar is unmet', () => {
    const result = pickCompositions('flagship-atelier', {
      ...baseSignals,
      photoCount: 1,
      hasPortrait: false,
    });
    // image-fullbleed is the global default when landscape signals exist;
    // editorial's hero pool is the fallback when image-fullbleed doesn't fit.
    expect(['image-fullbleed', 'magazine', 'display', 'minimal-center']).toContain(result.hero);
    // editorial's services pool first entries
    expect(['menu-card', 'numbered', 'large-cards', 'split-card', 'list']).toContain(result.services);
  });

  it('image-fullbleed is the default hero when landscape signals exist', () => {
    // Applies across styles (including flagship) per the photo-led default
    // policy. editorial-portrait + style-curated picks remain available via
    // the admin composition dropdown.
    const result = pickCompositions('flagship-atelier', {
      ...baseSignals,
      photoCount: 6,
      hasPortrait: true,
      hasLandscape: true,
    });
    expect(result.hero).toBe('image-fullbleed');
  });

  it('image-fullbleed remains the default even with portrait-only photos', () => {
    const result = pickCompositions('flagship-atelier', {
      ...baseSignals,
      photoCount: 6,
      hasPortrait: true,
      hasLandscape: false,
    });
    // Portrait photos cover into the hero frame via object-fit; image-fullbleed
    // stays the global default. editorial-portrait remains available via the
    // admin composition dropdown.
    expect(result.hero).toBe('image-fullbleed');
  });

  it('flagship-atelier picks film-strip gallery when photo bar is met', () => {
    const result = pickCompositions('flagship-atelier', {
      ...baseSignals,
      photoCount: 8,
      hasPortrait: true,
    });
    expect(result.gallery).toBe('film-strip');
  });

  it('gallery falls back to off when the photo bar is not met', () => {
    const result = pickCompositions('flagship-atelier', {
      ...baseSignals,
      photoCount: 1,
    });
    expect(result.gallery).toBe('off');
  });
});
