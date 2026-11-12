'use client';

// Landing-page conversion engine. Visitor types their business name, picks
// from Google candidates, hits Generate, and watches their site render in
// an iframe ~30s later. Then a domain wizard asks "do you have a domain?"
// and sends them to Stripe Checkout. Webhook handles the rest server-side.
//
// Niche is inferred server-side from the chosen Place's GBP category — we
// never ask the user. See lib/content-gen/niche-inference.ts.

import { useEffect, useRef, useState } from 'react';
import { getOrCreateFunnelSessionId } from '@/lib/funnel-session';
import { PRICING } from '@/lib/pricing';

// Preserve the post-generate state across refreshes and the Stripe → back
// button round-trip. We persist only the `result` phase + claim form fields;
// pre-generate state (typed name, candidates) is cheap to retype and not
// worth resuming. Cleared on successful checkout so a returning customer
// doesn't see the unclaimed-preview UI for a site they already own.
const RESULT_STORAGE_KEY = 'landing_generator_result_state';

type SavedResultState = {
  result: GenerateResult;
  claimStep: ClaimStep;
  claimEmail: string;
  requestedDomain: string;
};

function loadSavedResultState(): SavedResultState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(RESULT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedResultState;
    // Defensive: bail on anything that doesn't look like a real generated
    // site so a corrupted blob can't lock a user into a broken result view.
    if (!parsed?.result?.client_id || !parsed?.result?.slug) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveResultState(state: SavedResultState): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full / privacy mode — preservation is nice-to-have, never
    // block the user.
  }
}

function clearSavedResultState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(RESULT_STORAGE_KEY);
  } catch {
    // Ignore — clearing storage is best-effort.
  }
}

type Candidate = {
  id: string;
  displayName: string;
  formattedAddress: string;
  primaryType: string;
};

type GenerateResult = {
  success?: true;
  client_id: string;
  slug: string;
  business_name: string;
  platform_domain: string;
  // claim_token is only present for fresh generations. For duplicates we
  // route through the public URL without a token (RLS allows public reads
  // for claimed clients).
  claim_token?: string;
  url?: string;
  short_url?: string;
  inferred_niche?: string;
  industry_label?: string;
  // True when this slot represents an existing site that turned up via
  // the duplicate_place_id path. Suppresses the claim card and changes
  // the surrounding copy to "this site already exists".
  is_duplicate?: boolean;
  // Only set on the duplicate path — drives copy. 'claimed' renders the
  // iframe + "log in to portal" CTA. 'live' (unclaimed) skips the iframe
  // (token-gated, can't render without leaking the token) and shows the
  // "check your saved-preview email or contact support" recovery card.
  existing_status?: 'claimed' | 'live' | 'draft';
};

type Phase =
  | 'idle'
  | 'searching'
  | 'candidates'
  | 'generating'
  | 'result';

// Sub-state for the claim wizard inside the result phase. 'choice' shows the
// two tiles ("I have a domain" / "Register one for me"). Picking a tile
// flips to 'have' or 'need', each of which collects the domain string plus
// email and then redirects to Stripe Checkout.
type ClaimStep = 'choice' | 'have' | 'need';

type DomainCheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'taken'; alternatives: string[] }
  | { status: 'unknown' } // Namecheap unconfigured / parse failed
  | { status: 'invalid' };

// Loose-but-useful email format check: requires non-whitespace local, @,
// non-whitespace host, dot, and a TLD. Mirrors what the server's zod
// `.email()` accepts in the common case so we don't bounce users to Stripe
// only to reject them. Real validity is settled by the email actually
// reaching their inbox.
function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// Cosmetic — turns 'pizza_restaurant' into 'Pizza restaurant'. Used on
// candidate cards so the user visually confirms business type before clicking.
function humanizeType(t: string): string {
  if (!t) return '';
  const cleaned = t.replace(/_/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// Stable Google Maps URL for a place_id — the documented Maps URLs format,
// not an API call. Lets the visitor open their full GBP card (photos,
// reviews, hours) to confirm "yes this is me" without us paying for the
// Enterprise SKU rating/review fields.
function googleMapsUrl(c: Candidate): string {
  const query = encodeURIComponent(c.displayName || c.formattedAddress || c.id);
  return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${c.id}`;
}

// Build an iframe-friendly URL. On localhost we can't resolve subdomains, so
// we route through the /sites/[host] path. Production uses the apex
// subdomain directly.
//
// The claim_token suffix bypasses RLS — newly-generated clients have no
// owner yet, so any visitor with the token can preview them. For the
// duplicate-found path we may not have a token (claimed sites are public
// without one; unclaimed duplicates we don't expose token to randos), so
// the token suffix is omitted when absent.
function buildPreviewUrl(result: GenerateResult): string {
  const customerHost = `${result.slug}.${result.platform_domain}`;
  const tokenSuffix = result.claim_token
    ? `?t=${encodeURIComponent(result.claim_token)}`
    : '';
  if (typeof window === 'undefined') return result.url ?? `https://${customerHost}${tokenSuffix}`;
  const { hostname, origin } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  return isLocal
    ? `${origin}/sites/${encodeURIComponent(customerHost)}${tokenSuffix}`
    : `https://${customerHost}${tokenSuffix}`;
}

export function LandingGenerator() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  // Honeypot — humans never see this (display:none + tabIndex=-1), bots that
  // auto-fill every input will trip it and the server will reject the call.
  // Named "website" because that's a magnet for form-scraping bots.
  const [website, setWebsite] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Claim wizard state. The flow:
  //   1. claimStep='choice'     — user picks "have" or "need"
  //   2. claimStep='have'|'need' — collect domain + email, click "Continue
  //                                 to checkout" → POST /api/checkout/claim
  //                                 → redirect to Stripe.
  // On payment success Stripe redirects back to `/?claim_success={id}` and
  // the global ClaimSuccessModal (mounted in page.tsx) shows the confirmation.
  const [claimStep, setClaimStep] = useState<ClaimStep>('choice');
  const [claimEmail, setClaimEmail] = useState('');
  const [requestedDomain, setRequestedDomain] = useState('');
  const [domainCheck, setDomainCheck] = useState<DomainCheckState>({ status: 'idle' });
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);

  // "Save for later" — emails the visitor a restore link so they can come
  // back to this exact preview after generating a different business.
  // 'idle' hides the form; 'open' shows the email input; 'sent' shows the
  // success state and is sticky for the session.
  const [saveState, setSaveState] = useState<'idle' | 'open' | 'sending' | 'sent'>('idle');
  const [saveEmail, setSaveEmail] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Preview viewport toggle. Default to desktop because all our hero/services
  // compositions are designed at 1100px+ and a narrow iframe collapses them
  // to their mobile-stack layout — which is correct on phones but misleading
  // when the visitor is on a 1440px laptop and wants to see the real site.
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const previewFrameRef = useRef<HTMLDivElement>(null);
  const [previewFrameWidth, setPreviewFrameWidth] = useState(0);
  useEffect(() => {
    const node = previewFrameRef.current;
    if (!node) return;
    const obs = new ResizeObserver((entries) => {
      setPreviewFrameWidth(entries[0]?.contentRect.width ?? 0);
    });
    obs.observe(node);
    return () => obs.disconnect();
  }, [phase]); // re-observe when result mounts

  // Copy-to-clipboard feedback for the share button. Resets after 2s so
  // the button doesn't get stuck in the "Copied" state.
  const [copied, setCopied] = useState(false);

  const businessInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const candidatesRef = useRef<HTMLDivElement>(null);

  // Lazy ref — populated on first call to ensure server-side render returns
  // a stable empty string but client-side picks up the storage value
  // before any fetch fires.
  const funnelSessionIdRef = useRef<string>('');
  function funnelSessionId(): string {
    if (!funnelSessionIdRef.current) {
      funnelSessionIdRef.current = getOrCreateFunnelSessionId();
    }
    return funnelSessionIdRef.current;
  }

  useEffect(() => {
    // `block: 'nearest'` instead of 'start' for candidates/result so we
    // only scroll if the target isn't already visible. With 'start' the
    // page jerked under the user every time the result phase landed
    // (~30s after they clicked Build), even though the result mounts in
    // the same DOM location as the generating spinner they were just
    // looking at.
    //
    // Generating is the exception: the user just clicked Build my site
    // from somewhere in a (potentially long) candidates list, and the
    // candidates card has just unmounted underneath them — without an
    // explicit scroll they'd be stranded in whitespace below the much
    // smaller generating card. 'start' is correct here.
    if (phase === 'candidates' && candidates.length > 0) {
      candidatesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (phase === 'generating') {
      // Scroll to the whole hero (#generator on page.tsx), not just the
      // spinner card. The spinner sits inside the hero — putting the
      // hero at the top frames the wait with the H1 ("See your website
      // in 30 seconds") above the spinner instead of stranding the user
      // somewhere down the page after the candidates list collapses.
      document.getElementById('generator')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
    if (phase === 'result') {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [phase, candidates.length]);

  // Restore the result phase across refreshes / Stripe back-button. Order
  // of precedence:
  //   1. ?claim_success — returning customer, wipe stored state.
  //   2. ?restore=<id>&t=<token> — visitor clicked the "save your preview"
  //      email link. Fetch the saved site server-side and hydrate the
  //      result phase. Always wins over sessionStorage so a fresh email
  //      click reliably lands them on the preview they emailed themselves
  //      (their sessionStorage may have a *different* generated business).
  //   3. sessionStorage — same-tab refresh / back-button fallback.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('claim_success')) {
      clearSavedResultState();
      return;
    }

    const restoreId = params.get('restore');
    const restoreToken = params.get('t');
    if (restoreId && restoreToken) {
      (async () => {
        try {
          const res = await fetch(
            `/api/restore-preview?client_id=${encodeURIComponent(restoreId)}` +
              `&t=${encodeURIComponent(restoreToken)}`,
          );
          if (!res.ok) return;
          const data = (await res.json()) as GenerateResult;
          setResult(data);
          setPhase('result');
        } catch {
          // Restore failed — silently fall through to the empty landing
          // page. The user can re-search and re-generate from scratch.
        } finally {
          // Strip restore params either way so a refresh doesn't loop and
          // copy-pasted URLs don't leak the token to history.
          const cleanUrl =
            window.location.pathname + window.location.hash;
          window.history.replaceState({}, '', cleanUrl);
        }
      })();
      return;
    }

    const saved = loadSavedResultState();
    if (!saved) return;
    setResult(saved.result);
    setClaimStep(saved.claimStep);
    setClaimEmail(saved.claimEmail);
    setRequestedDomain(saved.requestedDomain);
    setPhase('result');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist whenever we're in the result phase. Transient phases
  // (searching / generating) are deliberately not persisted — they're
  // API-in-flight states that don't survive a remount.
  useEffect(() => {
    if (phase !== 'result' || !result) return;
    saveResultState({ result, claimStep, claimEmail, requestedDomain });
  }, [phase, result, claimStep, claimEmail, requestedDomain]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim()) return;
    (document.activeElement as HTMLElement | null)?.blur();
    setPhase('searching');
    setError(null);
    setCandidates([]);
    setSelectedId(null);
    setResult(null);
    try {
      const textQuery = address.trim()
        ? `${businessName.trim()} ${address.trim()}`
        : businessName.trim();
      const res = await fetch('/api/places-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textQuery,
          address: address.trim() || undefined,
          website,
          funnel_session_id: funnelSessionId(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.error === 'rate_limited'
            ? "You've searched a lot — give it an hour and try again."
            : data?.error === 'abuse_blocked'
              ? "Couldn't verify your browser. Refresh and try again."
              : 'Search failed. Try again or refine the business name.',
        );
        setPhase('idle');
        return;
      }
      const places: Candidate[] = data.places ?? [];
      setCandidates(places);
      if (places.length === 1) setSelectedId(places[0]!.id);
      setPhase(places.length > 0 ? 'candidates' : 'idle');
      if (places.length === 0) {
        setError("We couldn't find your business on Google. Make sure you have a Google Business Profile, or try a different spelling.");
      }
    } catch {
      setError('Search failed. Check your connection and try again.');
      setPhase('idle');
    }
  }

  async function handleGenerate(placeId: string) {
    (document.activeElement as HTMLElement | null)?.blur();
    setPhase('generating');
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_place_id: placeId,
          website,
          funnel_session_id: funnelSessionId(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Special-case duplicate_place_id.
        //
        //   claimed → render the iframe (claimed sites are public, no
        //             token needed) and show the "already claimed → log
        //             in to portal" card. is_duplicate=true suppresses
        //             the claim wizard.
        //
        //   live    → backend returned the existing claim_token; treat
        //             this exactly like a fresh generation so the
        //             visitor (almost always the original owner coming
        //             back) gets the iframe + claim wizard without
        //             having to dig up their save-preview email. Same
        //             security posture as SMS outreach short-links
        //             (which already expose the token in the URL).
        //
        //   draft   → mid-generation, no renderable preview; falls
        //             through to the friendly error.
        if (
          data?.error === 'duplicate_place_id' &&
          data?.existing_status === 'claimed' &&
          data?.slug &&
          data?.client_id &&
          data?.platform_domain
        ) {
          setResult({
            client_id: data.client_id,
            slug: data.slug,
            business_name: data.business_name ?? 'this business',
            platform_domain: data.platform_domain,
            is_duplicate: true,
            existing_status: 'claimed',
          });
          setPhase('result');
          return;
        }

        if (
          data?.error === 'duplicate_place_id' &&
          data?.existing_status === 'live' &&
          data?.slug &&
          data?.client_id &&
          data?.platform_domain &&
          data?.claim_token
        ) {
          setResult({
            client_id: data.client_id,
            slug: data.slug,
            business_name: data.business_name ?? 'this business',
            platform_domain: data.platform_domain,
            claim_token: data.claim_token,
          });
          setPhase('result');
          return;
        }

        // Friendly translation of the small set of pipeline failures.
        // duplicate_place_id with status='draft' falls through here — a
        // draft row is mid-generation, no renderable preview yet.
        const friendly =
          data?.error === 'duplicate_place_id'
            ? "We started building this site but it isn't ready yet — try again in a minute."
            : data?.error === 'business_not_operational'
              ? "Google marks this business as closed. Pick a different listing."
              : data?.error === 'rate_limited'
                ? "You've generated a few sites recently — give it an hour and try again."
                : data?.error === 'abuse_blocked'
                  ? "Couldn't verify your browser. Refresh and try again."
                  : 'Generation failed. Please try again in a moment.';
        setError(friendly);
        setPhase('candidates');
        return;
      }
      setResult(data as GenerateResult);
      setPhase('result');
    } catch {
      setError('Generation failed. Please try again.');
      setPhase('candidates');
    }
  }

  // Debounced .com availability check against /api/namecheap/check. Fires
  // 700ms after the user stops typing in the 'need' branch. We deliberately
  // skip the check for the 'have' branch — the user is asserting ownership,
  // not asking us to register, so availability is irrelevant.
  useEffect(() => {
    if (claimStep !== 'need') return;
    const trimmed = requestedDomain.trim().toLowerCase();
    if (!trimmed) {
      setDomainCheck({ status: 'idle' });
      return;
    }
    if (!/^[a-z0-9-]+\.com$/.test(trimmed)) {
      setDomainCheck({ status: 'invalid' });
      return;
    }
    setDomainCheck({ status: 'checking' });
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch('/api/namecheap/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain: trimmed,
            website,
            funnel_session_id: funnelSessionId(),
          }),
        });
        if (cancelled) return;
        const data = await res.json();
        if (!res.ok) {
          setDomainCheck({ status: 'unknown' });
          return;
        }
        if (data.status === 'available') setDomainCheck({ status: 'available' });
        else if (data.status === 'taken') {
          setDomainCheck({ status: 'taken', alternatives: data.alternatives ?? [] });
        } else setDomainCheck({ status: 'unknown' });
      } catch {
        if (!cancelled) setDomainCheck({ status: 'unknown' });
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [claimStep, requestedDomain, website]);

  async function handleStartCheckout() {
    if (!result) return;
    if (claimStep === 'choice') return;
    setClaimLoading(true);
    setClaimError(null);
    try {
      const res = await fetch('/api/checkout/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: result.client_id,
          claim_token: result.claim_token,
          email: claimEmail.trim(),
          domain_choice: claimStep,
          requested_domain: requestedDomain.trim().toLowerCase(),
          website,
          funnel_session_id: funnelSessionId(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        // If the server says it's already claimed, drop the stored state
        // so a refresh doesn't bring the user back to the same dead end.
        if (data?.error === 'already_claimed') clearSavedResultState();
        setClaimError(
          data?.error === 'already_claimed'
            ? "This site has already been claimed."
            : data?.error === 'rate_limited'
              ? "Too many checkout attempts. Wait an hour and try again."
              : data?.error === 'abuse_blocked'
                ? "Couldn't verify your browser. Refresh and try again."
                : "Couldn't start checkout. Please try again.",
        );
        setClaimLoading(false);
        return;
      }
      // Hard redirect to Stripe — preserves their session and prevents
      // accidental double-submit on the back button.
      window.location.href = data.url;
    } catch {
      setClaimError("Couldn't start checkout. Please try again.");
      setClaimLoading(false);
    }
  }

  // Shareable URL for the Copy button. Prefers the short URL (text-message
  // friendly) when the backend returned one; falls back to the full
  // slug.platform_domain?t=token form, which works identically — the
  // claim_token grants nothing beyond completing the $49 checkout, same
  // posture as the SMS outreach short-links.
  function shareableUrl(): string {
    if (!result) return '';
    if (result.short_url) return result.short_url;
    const host = `${result.slug}.${result.platform_domain}`;
    const tokenSuffix = result.claim_token
      ? `?t=${encodeURIComponent(result.claim_token)}`
      : '';
    return `https://${host}${tokenSuffix}`;
  }

  async function handleCopyLink() {
    const url = shareableUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older Safari / no-https can throw — silently fail rather than
      // surfacing an error toast. User can still right-click "Open in
      // new tab" and copy from the address bar.
    }
  }

  async function handleSavePreview() {
    if (!result?.claim_token) return;
    const trimmed = saveEmail.trim();
    if (!isValidEmail(trimmed)) return;
    setSaveState('sending');
    setSaveError(null);
    try {
      const res = await fetch('/api/save-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: result.client_id,
          claim_token: result.claim_token,
          email: trimmed,
          website,
          funnel_session_id: funnelSessionId(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(
          data?.error === 'rate_limited'
            ? "You've saved a few previews recently — give it an hour and try again."
            : data?.error === 'abuse_blocked'
              ? "Couldn't verify your browser. Refresh and try again."
              : "Couldn't send. Please try again.",
        );
        setSaveState('open');
        return;
      }
      setSaveState('sent');
    } catch {
      setSaveError("Couldn't send. Please try again.");
      setSaveState('open');
    }
  }

  function reset() {
    setPhase('idle');
    setBusinessName('');
    setAddress('');
    setCandidates([]);
    setSelectedId(null);
    setResult(null);
    setError(null);
    setClaimEmail('');
    setRequestedDomain('');
    setDomainCheck({ status: 'idle' });
    setClaimStep('choice');
    setClaimError(null);
    setSaveState('idle');
    setSaveEmail('');
    setSaveError(null);
    clearSavedResultState();
    setTimeout(() => businessInputRef.current?.focus(), 0);
  }

  const previewUrl = result ? buildPreviewUrl(result) : '';

  // ── Renders ────────────────────────────────────────────────────────────
  // Single flat tree, branches on phase. Keeps the search form mounted while
  // showing candidates underneath so the user can refine without losing
  // their typed name.

  return (
    <div className="w-full">
      {/* Search input — visible in idle / searching / candidates phases.
          Layered card: large business name field on top, smaller city
          field below with a pin icon, full-width amber CTA at the bottom.
          One subtle divider separates the form body from the CTA so the
          action reads as the natural next step. */}
      {(phase === 'idle' || phase === 'searching' || phase === 'candidates') && (
        <form
          onSubmit={handleSearch}
          className="relative bg-cream-50 rounded-2xl text-ink-900 overflow-hidden ring-1 ring-cream-50/10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] text-left"
        >
          <div className="px-5 sm:px-7 pt-6 pb-5 space-y-4">
            <div>
              <label htmlFor="biz" className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-700/70 mb-2">
                Your business name
              </label>
              <input
                id="biz"
                ref={businessInputRef}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Joe's Pizza"
                className="w-full bg-transparent text-ink-900 text-xl sm:text-2xl placeholder:text-ink-700/25 focus:outline-none"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="search"
                required
              />
            </div>
            <div className="flex items-center gap-2.5 text-ink-700/70">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 14s5-4.5 5-8.5a5 5 0 1 0-10 0C3 9.5 8 14 8 14Z" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="8" cy="5.5" r="1.8" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="City or zip (helps us find you)"
                className="flex-1 min-w-0 bg-transparent text-ink-700 text-sm sm:text-base placeholder:text-ink-700/40 focus:outline-none"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="search"
              />
            </div>
          </div>

          <div className="border-t border-ink-900/5" />

          <div className="p-3">
            <button
              type="submit"
              disabled={phase === 'searching' || !businessName.trim()}
              className="group w-full inline-flex items-center justify-center gap-2 bg-gradient-to-b from-amber-accent-soft to-amber-accent text-ink-900 rounded-xl py-4 text-base font-semibold shadow-[0_8px_24px_-8px_rgba(245,158,11,0.5)] hover:shadow-[0_12px_32px_-8px_rgba(245,158,11,0.7)] hover:brightness-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {phase === 'searching' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                  Searching…
                </>
              ) : (
                <>
                  Find my business
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* Honeypot — invisible to humans, magnet for form-scraping bots.
              The server rejects any submission where this is non-empty. */}
          <div aria-hidden style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
            <label htmlFor="website">Website (leave blank)</label>
            <input
              id="website"
              name="website"
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>
          {error && (phase === 'idle') && (
            <p className="px-5 sm:px-7 pb-4 text-sm text-red-700">{error}</p>
          )}
        </form>
      )}

      {/* Candidates — pick which business, then confirm via the bottom
          CTA. Click on a card only sets selection; generation fires from
          the explicit "Build my site" button so the 30s commitment is a
          deliberate second action, not a single-tap accident. */}
      {phase === 'candidates' && candidates.length > 0 && (
        <div
          ref={candidatesRef}
          className="mt-4 bg-cream-50 rounded-2xl ring-1 ring-cream-50/10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] text-ink-900 overflow-hidden text-left"
        >
          <div className="px-5 sm:px-7 pt-5 pb-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-700/70 mb-3">
              Is this you?
            </h3>
            <div className="space-y-2">
              {candidates.map((c) => {
                const selected = selectedId === c.id;
                return (
                  <div key={c.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left rounded-xl border px-4 py-3.5 transition-colors active:scale-[0.99] ${
                        selected
                          ? 'border-amber-accent bg-amber-accent/10'
                          : 'border-ink-900/10 hover:border-ink-900/20 hover:bg-cream-100'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className={`mt-1 inline-block w-4 h-4 rounded-full border-2 shrink-0 ${
                            selected ? 'border-amber-accent bg-amber-accent' : 'border-ink-900/20'
                          }`}
                        />
                        <div className="min-w-0 flex-1 pr-24">
                          <div className="font-medium truncate">{c.displayName || '(no name)'}</div>
                          {c.formattedAddress ? (
                            <div className="text-sm text-ink-700/70 mt-0.5 break-words">
                              {c.formattedAddress}
                            </div>
                          ) : (
                            <div className="text-sm text-ink-700/70 mt-0.5 italic">
                              Service area business
                            </div>
                          )}
                          {c.primaryType && (
                            <div className="text-xs text-amber-accent font-medium mt-1.5 uppercase tracking-wider">
                              {humanizeType(c.primaryType)}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                    {/* Sibling of the selection button (not nested) so the
                        link's click navigates without also flipping the
                        radio. Positioned over the card's top-right. */}
                    <a
                      href={googleMapsUrl(c)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-3 right-3 inline-flex items-center gap-1 text-xs text-ink-700/60 hover:text-ink-900 underline-offset-2 hover:underline"
                    >
                      View on Google
                      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="M6 3h7v7M13 3 6 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  </div>
                );
              })}
            </div>
            {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          </div>

          <div className="border-t border-ink-900/5" />

          <div className="p-3">
            <button
              type="button"
              onClick={() => selectedId && handleGenerate(selectedId)}
              disabled={!selectedId}
              className="group w-full inline-flex items-center justify-center gap-2 bg-gradient-to-b from-amber-accent-soft to-amber-accent text-ink-900 rounded-xl py-4 text-base font-semibold shadow-[0_8px_24px_-8px_rgba(245,158,11,0.5)] hover:shadow-[0_12px_32px_-8px_rgba(245,158,11,0.7)] hover:brightness-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              Build my site
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <p className="mt-2.5 text-center text-xs text-ink-700/50">
              Takes about 30 seconds. No signup needed to preview.
            </p>
          </div>
        </div>
      )}

      {/* Generating — long-running, reassure */}
      {phase === 'generating' && (
        <div className="mt-4 bg-cream-50 rounded-2xl p-8 ring-1 ring-ink-900/10 text-ink-900 text-center">
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full rounded-full bg-amber-accent opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-accent" />
            </span>
            <p className="font-display text-lg">Building your site…</p>
          </div>
          <p className="text-sm text-ink-700">
            We&rsquo;re writing copy from your reviews, picking a palette, and pulling your best
            photos. This takes about 30 seconds.
          </p>
        </div>
      )}

      {/* Result — iframe + claim CTA */}
      {phase === 'result' && result && (
        <div ref={resultRef} className="mt-4 space-y-4">
          {/* Iframe card */}
          <div className="bg-cream-50 rounded-2xl ring-1 ring-ink-900/10 overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-ink-900/10 bg-ink-900/[0.06] text-ink-900">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex gap-1.5 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-ink-900/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-ink-900/15" />
                  <span className="w-2.5 h-2.5 rounded-full bg-ink-900/15" />
                </div>
                <div className="ml-2 px-3 py-1 rounded-md bg-cream-50 ring-1 ring-ink-900/10 text-[11px] font-mono text-ink-700/70 truncate hidden sm:block">
                  {result.slug}.{result.platform_domain}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {/* Viewport toggle — segmented control between desktop and
                    mobile preview. Desktop is the default since the trades
                    + restaurant heroes are designed at >=1100px and would
                    look mobile-stacked in a narrow iframe otherwise. */}
                <div
                  role="group"
                  aria-label="Preview viewport"
                  className="hidden md:inline-flex items-center gap-0.5 p-0.5 rounded-md bg-ink-900/[0.06] ring-1 ring-ink-900/10"
                >
                  <button
                    type="button"
                    onClick={() => setViewMode('desktop')}
                    aria-pressed={viewMode === 'desktop'}
                    title="Desktop preview"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      viewMode === 'desktop'
                        ? 'bg-cream-50 text-ink-900 shadow-sm ring-1 ring-ink-900/10'
                        : 'text-ink-700/70 hover:text-ink-900'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <rect x="1.5" y="2.5" width="13" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M6 14h4M8 11.5V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('mobile')}
                    aria-pressed={viewMode === 'mobile'}
                    title="Mobile preview"
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      viewMode === 'mobile'
                        ? 'bg-cream-50 text-ink-900 shadow-sm ring-1 ring-ink-900/10'
                        : 'text-ink-700/70 hover:text-ink-900'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <rect x="4.5" y="1.5" width="7" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M7 13h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Mobile
                  </button>
                </div>
                {/* "Generate another" only for fresh generations — for an
                    already-claimed duplicate the claim card has its own
                    "Try a different business" button which is clearer in
                    context. */}
                {!result.is_duplicate && (
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cream-50 ring-1 ring-ink-900/10 text-xs font-medium text-ink-900 hover:bg-cream-50/70 hover:ring-ink-900/20 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M2.5 8a5.5 5.5 0 0 1 9.4-3.9M13.5 8a5.5 5.5 0 0 1-9.4 3.9M11.5 2v3h-3M4.5 14v-3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="hidden sm:inline">Generate another</span>
                    <span className="sm:hidden">New</span>
                  </button>
                )}
                {/* Copy link — shows the short URL when we have one
                    (text-message friendly) and the full preview URL
                    otherwise. Skipped for the claimed-duplicate case
                    where there's no claim_token to share. */}
                {!(result.is_duplicate && result.existing_status === 'claimed') && (
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cream-50 ring-1 ring-ink-900/10 text-xs font-medium text-ink-900 hover:bg-cream-50/70 hover:ring-ink-900/20 transition-colors"
                  >
                    {copied ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 16 16" fill="none" aria-hidden>
                          <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="hidden sm:inline">Copied</span>
                        <span className="sm:hidden">✓</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
                          <path d="M5 5V3.5A1.5 1.5 0 0 1 6.5 2h6A1.5 1.5 0 0 1 14 3.5v6A1.5 1.5 0 0 1 12.5 11H11M9.5 5h-6A1.5 1.5 0 0 0 2 6.5v6A1.5 1.5 0 0 0 3.5 14h6A1.5 1.5 0 0 0 11 12.5v-6A1.5 1.5 0 0 0 9.5 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="hidden sm:inline">Copy link</span>
                        <span className="sm:hidden">Copy</span>
                      </>
                    )}
                  </button>
                )}
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cream-50 ring-1 ring-ink-900/10 text-xs font-medium text-ink-900 hover:bg-cream-50/70 hover:ring-ink-900/20 transition-colors"
                >
                  <span className="hidden sm:inline">Open in new tab</span>
                  <span className="sm:hidden">Open</span>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M6 3h7v7M13 3 6 10M5 6H3v7h7v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            </div>
            {/* Viewport-aware preview frame.
                Desktop: iframe rendered at fixed 1280px width and CSS-scaled
                  down to fit the container. Preserves the real desktop
                  layout (the trades hero stays 2-col, the cafe magazine
                  layout doesn't collapse, etc.) even when the parent card
                  is only 700px wide.
                Mobile: iframe rendered at 390px (iPhone Pro width), centered
                  on a darker rail so the phone-frame metaphor reads. */}
            {(() => {
              const desktopWidth = 1280;
              const desktopHeight = 800;
              const mobileWidth = 390;
              const mobileHeight = 760;

              if (viewMode === 'mobile') {
                return (
                  <div
                    ref={previewFrameRef}
                    className="bg-ink-900/[0.08] flex items-start justify-center py-6"
                    style={{ height: `min(${mobileHeight + 48}px, 80vh)` }}
                  >
                    <iframe
                      key={`m-${previewUrl}`}
                      src={previewUrl}
                      title={`${result.business_name} preview (mobile)`}
                      className="bg-white shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)] rounded-[28px]"
                      style={{
                        width: `${mobileWidth}px`,
                        height: `${mobileHeight}px`,
                        border: '0',
                      }}
                      loading="lazy"
                    />
                  </div>
                );
              }

              // Desktop — scale-down container. We measure width via the
              // ResizeObserver wired up above; before the first measurement
              // we fall back to scale=1 (it'll briefly overflow, then snap
              // into place on the next frame).
              const scale = previewFrameWidth > 0
                ? Math.min(1, previewFrameWidth / desktopWidth)
                : 1;
              const scaledHeight = desktopHeight * scale;
              return (
                <div
                  ref={previewFrameRef}
                  className="bg-white relative overflow-hidden"
                  style={{ height: `min(${scaledHeight}px, 80vh)` }}
                >
                  <iframe
                    key={`d-${previewUrl}`}
                    src={previewUrl}
                    title={`${result.business_name} preview (desktop)`}
                    className="bg-white"
                    style={{
                      width: `${desktopWidth}px`,
                      height: `${desktopHeight}px`,
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left',
                      border: '0',
                    }}
                    loading="lazy"
                  />
                </div>
              );
            })()}
          </div>

          {/* Already-claimed duplicate — show the site (we did above) but
              skip the claim wizard since it already has an owner. The
              unclaimed-duplicate path doesn't reach here: handleGenerate
              treats it as a fresh generation and falls through to the
              claim wizard below. */}
          {result.is_duplicate ? (
            <div className="bg-ink-900 text-cream-50 rounded-2xl p-6 sm:p-8 ring-1 ring-cream-50/10 text-center">
              <p className="text-amber-accent text-xs font-semibold uppercase tracking-[0.2em] mb-2">
                Already claimed
              </p>
              <h3 className="font-display text-2xl sm:text-3xl font-light tracking-tight">
                {result.business_name} is live.
              </h3>
              <p className="text-cream-100/70 text-sm mt-3 max-w-md mx-auto">
                Someone already claimed this site. If it&rsquo;s yours, log in to the customer
                portal to make changes. If you think this is a mistake, contact support.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
                <a
                  href="/login"
                  className="inline-flex items-center justify-center px-5 py-2.5 border border-cream-50/20 rounded-full text-sm font-medium hover:bg-cream-50/5 transition-colors"
                >
                  Log in to portal
                </a>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-b from-amber-accent-soft to-amber-accent text-ink-900 font-semibold rounded-full text-sm hover:brightness-95 transition-all"
                >
                  Try a different business
                </button>
              </div>
            </div>
          ) : (
          /* Claim wizard — three substates driven by claimStep. The dark
             card matches the iframe header for visual continuity. */
          <div className="bg-ink-900 text-cream-50 rounded-2xl p-6 sm:p-8 ring-1 ring-cream-50/10">
            <div className="mb-5">
              <p className="text-amber-accent text-xs font-semibold uppercase tracking-[0.2em] mb-2">
                This is yours
              </p>
              <h3 className="font-display text-2xl sm:text-3xl font-light tracking-tight">
                Claim {result.business_name} for {PRICING.starter.label}.
              </h3>
              <p className="text-cream-100/70 text-sm mt-2">
                Hosting, custom domain, online booking, and ongoing updates — all included.
                No setup fee. Cancel anytime.
              </p>
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-cream-50/[0.04] border border-cream-50/10 px-3 py-2.5">
                <svg className="w-4 h-4 mt-0.5 shrink-0 text-amber-accent" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p className="text-xs text-cream-100/70 leading-relaxed">
                  Notice anything off? <span className="text-cream-50">Copy, photos, pricing, hours — all changes are free</span> once you claim. Just tell us what to fix and we&rsquo;ll handle it.
                </p>
              </div>
            </div>

            {claimStep === 'choice' && (
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setClaimStep('have')}
                  className="group text-left rounded-xl border border-cream-50/15 bg-cream-50/[0.02] hover:border-amber-accent/50 hover:bg-cream-50/[0.04] transition-colors p-5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">🌐</span>
                    <svg className="w-4 h-4 text-cream-100/40 group-hover:text-amber-accent group-hover:translate-x-0.5 transition-all" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="font-display text-lg">I have a domain</p>
                  <p className="text-cream-100/60 text-sm mt-1">Point your existing domain at us.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setClaimStep('need')}
                  className="group text-left rounded-xl border border-cream-50/15 bg-cream-50/[0.02] hover:border-amber-accent/50 hover:bg-cream-50/[0.04] transition-colors p-5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">✨</span>
                    <svg className="w-4 h-4 text-cream-100/40 group-hover:text-amber-accent group-hover:translate-x-0.5 transition-all" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="font-display text-lg">Register one for me</p>
                  <p className="text-cream-100/60 text-sm mt-1">Pick a name, we&rsquo;ll handle the rest.</p>
                </button>
              </div>
            )}

            {(claimStep === 'have' || claimStep === 'need') && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleStartCheckout();
                }}
                className="space-y-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    setClaimStep('choice');
                    setRequestedDomain('');
                    setDomainCheck({ status: 'idle' });
                    setClaimError(null);
                  }}
                  className="text-xs text-cream-100/50 hover:text-cream-50 underline-offset-4 hover:underline inline-flex items-center gap-1"
                >
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M13 8H3m0 0 4.5-4.5M3 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Back
                </button>

                <div>
                  <label htmlFor="domain" className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-cream-100/70 mb-1.5">
                    {claimStep === 'have' ? 'Your existing domain' : 'Pick your domain (.com only)'}
                  </label>
                  <input
                    id="domain"
                    type="text"
                    value={requestedDomain}
                    onChange={(e) => setRequestedDomain(e.target.value)}
                    required
                    placeholder={claimStep === 'have' ? 'yourbusiness.com' : 'yourbusiness.com'}
                    className="w-full bg-cream-50/5 border border-cream-50/15 rounded-lg px-4 min-h-[52px] text-base text-cream-50 placeholder:text-cream-100/30 focus:outline-none focus:border-amber-accent transition-colors"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="url"
                  />
                  {claimStep === 'need' && (
                    <DomainStatusBadge
                      state={domainCheck}
                      onPickAlternative={(alt) => setRequestedDomain(alt)}
                    />
                  )}
                </div>

                <div>
                  <label htmlFor="claim-email" className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-cream-100/70 mb-1.5">
                    Your email
                  </label>
                  <input
                    id="claim-email"
                    type="email"
                    value={claimEmail}
                    onChange={(e) => setClaimEmail(e.target.value)}
                    required
                    placeholder="you@yourbusiness.com"
                    className="w-full bg-cream-50/5 border border-cream-50/15 rounded-lg px-4 min-h-[52px] text-base text-cream-50 placeholder:text-cream-100/30 focus:outline-none focus:border-amber-accent transition-colors"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    inputMode="email"
                  />
                  {claimEmail.trim() && !isValidEmail(claimEmail.trim()) && (
                    <p className="text-xs text-red-300 mt-1.5">
                      Please enter a valid email address.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={
                    claimLoading ||
                    !isValidEmail(claimEmail.trim()) ||
                    !requestedDomain.trim() ||
                    (claimStep === 'need' && domainCheck.status === 'taken') ||
                    (claimStep === 'need' && domainCheck.status === 'invalid') ||
                    (claimStep === 'need' && domainCheck.status === 'checking')
                  }
                  className="group w-full inline-flex items-center justify-center gap-2 bg-gradient-to-b from-amber-accent-soft to-amber-accent text-ink-900 rounded-xl py-4 text-base font-semibold shadow-[0_8px_24px_-8px_rgba(245,158,11,0.5)] hover:shadow-[0_12px_32px_-8px_rgba(245,158,11,0.7)] hover:brightness-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {claimLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                      </svg>
                      Redirecting to checkout…
                    </>
                  ) : (
                    <>
                      Continue to checkout — {PRICING.starter.label}
                      <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  )}
                </button>

                {claimError && <p className="text-sm text-red-300">{claimError}</p>}

                <p className="text-xs text-cream-100/50 text-center">
                  {claimStep === 'have'
                    ? "After payment, we'll email DNS instructions to point your domain at your site."
                    : "After payment, we register the domain and email you when it's live (~15 min)."}
                </p>
              </form>
            )}

            {/* Save-for-later — emails a restore link so the visitor can
                generate another business now and come back to this one
                later. Only shown for fresh generations (claim_token must
                be present; the duplicate-claimed path takes a different
                branch). */}
            {result.claim_token && (
              <div className="mt-5 pt-5 border-t border-cream-50/10">
                {saveState === 'sent' ? (
                  <div className="flex items-start gap-2 text-sm text-cream-100/80">
                    <svg className="w-4 h-4 mt-0.5 shrink-0 text-amber-accent" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p>
                      Sent. Check <span className="text-cream-50">{saveEmail}</span> for the link to come back to this preview.
                    </p>
                  </div>
                ) : saveState === 'open' || saveState === 'sending' ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSavePreview();
                    }}
                    className="space-y-3"
                  >
                    <label htmlFor="save-email" className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-cream-100/70">
                      Email me the link to this preview
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="save-email"
                        type="email"
                        value={saveEmail}
                        onChange={(e) => setSaveEmail(e.target.value)}
                        required
                        placeholder="you@yourbusiness.com"
                        className="flex-1 bg-cream-50/5 border border-cream-50/15 rounded-lg px-4 min-h-[44px] text-sm text-cream-50 placeholder:text-cream-100/30 focus:outline-none focus:border-amber-accent transition-colors"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        inputMode="email"
                      />
                      <button
                        type="submit"
                        disabled={saveState === 'sending' || !isValidEmail(saveEmail.trim())}
                        className="inline-flex items-center justify-center px-5 min-h-[44px] border border-cream-50/20 rounded-lg text-sm font-medium hover:bg-cream-50/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saveState === 'sending' ? 'Sending…' : 'Send link'}
                      </button>
                    </div>
                    {saveError && <p className="text-sm text-red-300">{saveError}</p>}
                    <p className="text-xs text-cream-100/50">
                      We&rsquo;ll only email this once. The link drops you right back here.
                    </p>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSaveError(null);
                      // Pre-fill from the claim wizard so users who've
                      // started typing their email don't retype it.
                      if (!saveEmail && claimEmail) setSaveEmail(claimEmail);
                      setSaveState('open');
                    }}
                    className="inline-flex items-center gap-2 text-sm text-cream-100/70 hover:text-cream-50 underline-offset-4 hover:underline"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M2.5 4.5l5.5 4 5.5-4M2.5 4.5h11v7h-11v-7Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Not ready yet? Email me this preview to finish later.
                  </button>
                )}
              </div>
            )}
          </div>
          )}
        </div>
      )}
    </div>
  );
}

// Inline availability indicator under the domain input. Updates as the
// debounced Namecheap check resolves. When 'unknown' (no API creds or
// parse failure) we show a neutral "we'll confirm after payment" note so
// the form still feels usable without Namecheap configured.
function DomainStatusBadge({
  state,
  onPickAlternative,
}: {
  state: DomainCheckState;
  onPickAlternative: (alt: string) => void;
}) {
  if (state.status === 'idle') return null;
  if (state.status === 'invalid') {
    return (
      <p className="mt-2 text-xs text-cream-100/50">
        Use letters, numbers, and hyphens — and end in <code className="text-cream-100/70">.com</code>.
      </p>
    );
  }
  if (state.status === 'checking') {
    return (
      <p className="mt-2 text-xs text-cream-100/60 inline-flex items-center gap-1.5">
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        Checking availability…
      </p>
    );
  }
  if (state.status === 'available') {
    return (
      <p className="mt-2 text-xs text-emerald-300 inline-flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="m4 8 3 3 5-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Available — included in your subscription.
      </p>
    );
  }
  if (state.status === 'unknown') {
    return (
      <p className="mt-2 text-xs text-cream-100/50">
        We&rsquo;ll confirm availability and let you know within 15 minutes after payment.
      </p>
    );
  }
  // 'taken' — surface alternatives
  return (
    <div className="mt-2">
      <p className="text-xs text-red-300 inline-flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Taken — try one of these:
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {state.alternatives.map((alt) => (
          <button
            key={alt}
            type="button"
            onClick={() => onPickAlternative(alt)}
            className="text-xs px-2.5 py-1 rounded-full bg-cream-50/10 hover:bg-cream-50/15 text-cream-50 transition-colors"
          >
            {alt}
          </button>
        ))}
      </div>
    </div>
  );
}
