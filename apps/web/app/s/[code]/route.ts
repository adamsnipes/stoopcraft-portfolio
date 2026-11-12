import { NextRequest, NextResponse, after } from 'next/server';
import { createHash } from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { CHEAP_BRAND, clientSubdomainHost, isCheapBrandClient, isCheapBrandHost } from '@/lib/marketing-brand';

// SHA-256(ip + ADMIN_SECRET). The secret salts the hash so a leaked DB can't
// be rainbow-tabled against common IP ranges. Returns null if no IP available.
function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const secret = process.env.ADMIN_SECRET ?? '';
  return createHash('sha256').update(`${ip}${secret}`).digest('hex');
}

function clientIpFromHeaders(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0];
    if (first) return first.trim();
  }
  return req.headers.get('x-real-ip') ?? req.headers.get('cf-connecting-ip');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await params;
  const supabase = createServiceRoleClient();

  const { data } = await supabase
    .from('clients')
    .select('id, slug, claim_token, status, brand')
    .eq('short_code', code)
    .single();

  // stupidcheapwebsites.com/s/<code> only resolves that brand's clients.
  const onBrandDomain = isCheapBrandHost(req.headers.get('host') ?? '');
  if (onBrandDomain && !isCheapBrandClient(data?.brand)) {
    return NextResponse.redirect(CHEAP_BRAND.url);
  }
  if (!data) {
    return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL ?? 'https://stoopcraft.com'));
  }

  // Snapshot request data before scheduling — `after` runs after the response
  // is sent, when the request object may no longer be valid.
  const ipHash = hashIp(clientIpFromHeaders(req));
  const userAgent = req.headers.get('user-agent');
  const campaign = req.nextUrl.searchParams.get('c');
  const clientId = data.id;

  // Each short_code is 1:1 with a client_id, so counting DISTINCT client_id of
  // clickers gives unique-leads-clicked cleanly — iMessage previews and the
  // recipient's real click both belong to the same client_id and collapse to 1.
  // Rate = clickers / total clients in batch.
  //
  // `after` schedules this to run after the redirect response is sent. On
  // serverless platforms it uses waitUntil under the hood so the function
  // isn't terminated mid-insert. Failures are logged, never block the redirect.
  after(async () => {
    try {
      const { error } = await supabase.from('events').insert({
        client_id: clientId,
        type: 'short_url_click',
        ip_hash: ipHash,
        user_agent: userAgent,
        metadata: campaign ? { campaign } : {},
      });
      if (error) console.error('[short-url] click log failed', { code, error: error.message });
    } catch (err) {
      console.error('[short-url] click log threw', {
        code,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Brand clients go to their brand subdomain.
  const siteUrl = `https://${clientSubdomainHost(data)}`;

  if (data.status === 'claimed') {
    return NextResponse.redirect(siteUrl);
  }

  return NextResponse.redirect(`${siteUrl}?t=${data.claim_token}`);
}
