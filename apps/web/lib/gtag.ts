// Typed wrapper for the Google Ads gtag global (installed by
// app/_components/GoogleAds.tsx). Safe to call anywhere: no-ops if gtag never
// loaded (customer-served sites, where GoogleAds is gated off, or a
// blocked/failed gtag.js) instead of throwing on undefined gtag.

type Gtag = (
  command: 'event' | 'config' | 'js' | 'set',
  eventOrTarget: string,
  params?: Record<string, unknown>,
) => void;

// Conversion label for the "Submit lead form" (Website) conversion action in
// Google Ads (account AW-11386315496). Mirrors the Meta `Lead` event fired
// alongside it in the agency ContactForm.
const LEAD_CONVERSION_SEND_TO = 'AW-11386315496/jxbXCKrSntEcEOjFtbUq';

function gtagEvent(event: string, params?: Record<string, unknown>) {
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag === 'function') gtag('event', event, params);
}

// Fire the Google Ads lead-form conversion. Call only on a confirmed submission,
// matching the Meta Lead fire so the two ad platforms report the same event.
export function trackLeadConversion() {
  gtagEvent('conversion', { send_to: LEAD_CONVERSION_SEND_TO });
}
