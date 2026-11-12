// ============================================================================
// Background treatment composer
//
// Layers a decorative pattern on top of a solid background color, returning a
// single CSS background shorthand value. Sections that read
// `var(--color-background)` get the treatment for free — no per-section
// changes needed because CSS multi-background composition does the heavy
// lifting.
//
// Pure helper — no server-only dependencies. Imported by both Site.tsx (SSR)
// and PreviewBridge.tsx (client) so the runtime preview can recompose when
// the admin tweaks colors.
// ============================================================================

import type { BackgroundTreatment } from '@dfy/db';

const TREATMENTS: Record<BackgroundTreatment, string> = {
  // Soft accent-tinted radial gradients in two corners. Quiet — sits behind
  // content without competing.
  mesh:
    'radial-gradient(circle at 15% 20%, color-mix(in srgb, var(--color-accent) 16%, transparent), transparent 45%),' +
    ' radial-gradient(circle at 85% 80%, color-mix(in srgb, var(--color-accent) 12%, transparent), transparent 50%)',

  // Larger, more colorful organic shapes. Three blobs spread across the page,
  // one tinted with --color-text for contrast against the accent pair.
  blobs:
    'radial-gradient(circle at 18% 28%, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent 55%),' +
    ' radial-gradient(circle at 82% 72%, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent 60%),' +
    ' radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--color-text) 8%, transparent), transparent 65%)',

  // Architectural / blueprint dot grid. Repeats every 22px.
  dotgrid:
    'radial-gradient(circle, color-mix(in srgb, var(--color-text) 18%, transparent) 1px, transparent 1.5px) 0 0 / 22px 22px',

  // Film / print noise. Inline SVG turbulence rendered at 6% alpha so it
  // texturizes without dirtying readability. The data URI is small enough
  // that inlining beats hosting a separate asset.
  grain:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>" +
    "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>" +
    "<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0'/></filter>" +
    "<rect width='200' height='200' filter='url(%23n)'/></svg>\") 0 0 / 240px 240px",
};

export const TREATMENT_KEYS: ReadonlyArray<BackgroundTreatment> = [
  'mesh',
  'blobs',
  'dotgrid',
  'grain',
];

/**
 * Compose a CSS background value from a base color and optional treatment.
 * Treatment layers go on top, the solid color sits underneath. Returns the
 * raw color when no treatment is set so existing pages render unchanged.
 */
export function composeBackground(
  bgColor: string,
  treatment?: BackgroundTreatment | null,
): string {
  if (!treatment) return bgColor;
  const layers = TREATMENTS[treatment];
  if (!layers) return bgColor;
  return `${layers}, ${bgColor}`;
}
