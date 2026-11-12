import { revalidatePath } from 'next/cache';
import { CHEAP_BRAND } from '@/lib/marketing-brand';

/**
 * Revalidate a client's site in Next.js ISR cache.
 * Must use the DESTINATION path (after proxy.ts rewrite), not the browser URL.
 * See DECISIONS.md Decision 4 for the Next.js 16 revalidatePath/rewrites note.
 */
export function revalidateClientSite(slug: string, customDomain?: string | null): void {
  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';

  // Revalidate the subdomain path
  revalidatePath(`/sites/${encodeURIComponent(`${slug}.${platformDomain}`)}`);
  // Brand clients render under their brand subdomain instead; revalidating the
  // path of the domain a client isn't on is a no-op, so do both.
  revalidatePath(`/sites/${encodeURIComponent(`${slug}.${CHEAP_BRAND.domain}`)}`);

  // Also revalidate custom domain if present
  if (customDomain) {
    revalidatePath(`/sites/${encodeURIComponent(customDomain)}`);
  }
}
