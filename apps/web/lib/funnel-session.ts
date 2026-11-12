// Client-side funnel session ID — one UUID per visitor's funnel attempt,
// persisted in sessionStorage. A reload mid-flow keeps the same id (still
// the "same journey" in Axiom / PostHog), a closed tab + new tab gets a
// fresh id. Shared between LandingGenerator and PostHogProvider so the
// id ends up on both Axiom log lines (via /api/* request bodies) and
// PostHog events (as a super property), letting you pivot between tools
// for the same visitor.

export const FUNNEL_SESSION_STORAGE_KEY = 'funnel_session_id';

export function getOrCreateFunnelSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.sessionStorage.getItem(FUNNEL_SESSION_STORAGE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.sessionStorage.setItem(FUNNEL_SESSION_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // Privacy-mode browsers / disabled storage — ephemeral id so the
    // current page still emits a consistent value, even if a reload
    // starts over.
    return crypto.randomUUID();
  }
}

export function readFunnelSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(FUNNEL_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}
