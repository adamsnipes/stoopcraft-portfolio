// ============================================================================
// deriveAltBg — auto-shade the base background by ~4% to produce the
// alternating-section color when the admin hasn't explicitly set one.
//
// Dark backgrounds get lightened, light backgrounds darkened, so the alt
// reads as a sibling tone rather than fighting the palette. Returns null
// for un-parseable input — the caller falls back to the base bg, which
// keeps unconfigured rows visually consistent.
// ============================================================================

export function deriveAltBg(hex: string): string | null {
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

  // Luminance-aware: dark bgs go lighter, light bgs go darker.
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const delta = luma < 0.5 ? 10 : -10;

  const shift = (c: number) => Math.max(0, Math.min(255, c + delta));
  const out = [shift(r), shift(g), shift(b)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('');
  return `#${out}`;
}
