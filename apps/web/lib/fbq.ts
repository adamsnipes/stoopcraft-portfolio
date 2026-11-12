// Typed wrapper for the Meta Pixel global (installed by app/_components/MetaPixel.tsx).
// Safe to call anywhere: no-ops if the pixel never loaded (customer-served
// sites, or a blocked/failed fbevents.js) instead of throwing on undefined fbq.

type Fbq = (
  command: 'track' | 'trackCustom' | 'init',
  event: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string },
) => void;

// `options.eventID` should match the event_id sent to the Conversions API for
// the same action, so Meta deduplicates the browser + server copies.
export function trackPixel(
  event: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string },
) {
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (typeof fbq === 'function') fbq('track', event, params, options);
}
