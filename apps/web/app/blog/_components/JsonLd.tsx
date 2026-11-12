import { headers } from 'next/headers';

// Emits one or more JSON-LD blocks with the per-request CSP nonce. The strict
// nonce-based CSP (proxy.ts) drops any inline <script> without the nonce — even
// non-executable ld+json — so we thread it through from the request headers,
// exactly like app/layout.tsx does for the Organization/WebSite schema.
export async function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Array<Record<string, unknown> | null>;
}) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const items = (Array.isArray(data) ? data : [data]).filter(
    (d): d is Record<string, unknown> => d != null
  );
  return (
    <>
      {items.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }}
        />
      ))}
    </>
  );
}
