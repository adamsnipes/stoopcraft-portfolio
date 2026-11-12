'use client';

// PostHog initialization + App Router pageview capture. Mounted in
// layout.tsx around children, gated server-side on non-customer sites so
// we never track visitors to a customer's own published site under our
// PostHog account (different business, different privacy expectation).
//
// Why a Provider over `instrumentation-client.ts`: the Provider pattern
// gives us a stable place to read sessionStorage and register the
// funnel_session_id as a super property — every PostHog event will carry
// that id, which is the same UUID we send in /api/* request bodies. That
// makes Axiom rows (funnel ops, errors) and PostHog rows (pageviews,
// autocapture) joinable for a single visitor.
//
// `defaults: '2026-01-30'` opts into PostHog's current default set
// (history-API pageview tracking for SPA navigations, $pageleave, dead
// clicks, rage clicks) — without it App Router client-side navigations
// don't emit pageviews because Next.js doesn't trigger a full page load.
//
// No-op when NEXT_PUBLIC_POSTHOG_KEY is unset so local dev / preview
// branches without the env var don't error or send junk events.

import { useEffect } from 'react';
import posthog from 'posthog-js';
import { readFunnelSessionId } from '@/lib/funnel-session';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    if (posthog.__loaded) return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      defaults: '2026-01-30',
      capture_pageview: 'history_change',
      capture_pageleave: true,
      person_profiles: 'identified_only',
    });
    const sessionId = readFunnelSessionId();
    if (sessionId) {
      posthog.register({ funnel_session_id: sessionId });
    }
  }, []);

  return <>{children}</>;
}
