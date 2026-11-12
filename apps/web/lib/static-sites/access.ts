import { createServiceRoleClient } from '@/lib/supabase/server';
import { cancellationHasEnded } from '@/lib/cancellation';

// ============================================================================
// Access control for static-site serving. Keyed by slug, WITHOUT the
// `content!inner` join the template path uses (static clients have no content
// row). Service role bypasses RLS, so claimed rows are readable for serving
// and admin preview alike.
//
// Static sites are admin-uploaded demos the operator pitches at the bare host,
// so BOTH 'live' (pre-purchase) and 'claimed' (purchased) serve publicly — no
// token required. The difference is indexability: 'live' is noindex'd by the
// route handler, 'claimed' is indexable. Draft never serves. A cancelled client
// keeps serving until its paid period ends (expires_at), then goes offline —
// what the cancellation policy and emails promise.
//
// 'paused' is a reversible kill switch (billing untouched, data preserved). It
// does not serve the bundle, but — unlike draft/expired — it is a distinct,
// recoverable state, so the route surfaces a branded 503 "temporarily
// unavailable" placeholder rather than a bare 404.
// ============================================================================

export type StaticServeResult = {
  clientId: string;
  /**
   * 'claimed' (public, indexable) or 'live' (public, noindex demo) serve the
   * bundle. 'paused' does not — the route renders a 503 placeholder instead.
   */
  status: 'claimed' | 'live' | 'paused';
  /**
   * When true, suppress the pre-sale "claim this site" banner even on a 'live'
   * bundle (demo/sample builds kept live for the portfolio). Irrelevant once
   * claimed — the banner never renders on 'claimed' sites regardless.
   */
  hideClaimBanner: boolean;
  /** The client's sales brand — picks which claim banner is injected. */
  brand: string;
};

/** Decide whether a static site may be served for `slug`. Null = not serveable. */
export async function resolveStaticServe(slug: string): Promise<StaticServeResult | null> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from('clients')
    .select('id, status, render_mode, cancelled_at, expires_at, owner_user_id, hide_claim_banner, brand')
    .eq('slug', slug)
    .eq('render_mode', 'static')
    .single();

  if (error || !data) return null;
  if (cancellationHasEnded(data)) return null;

  const hideClaimBanner = data.hide_claim_banner ?? false;
  const brand = data.brand ?? 'stoopcraft';

  if (data.status === 'claimed' && data.owner_user_id) {
    return { clientId: data.id, status: 'claimed', hideClaimBanner, brand };
  }
  if (data.status === 'live') {
    return { clientId: data.id, status: 'live', hideClaimBanner, brand };
  }
  if (data.status === 'paused') {
    return { clientId: data.id, status: 'paused', hideClaimBanner, brand };
  }

  return null;
}
