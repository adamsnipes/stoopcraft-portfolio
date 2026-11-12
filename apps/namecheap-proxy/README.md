# namecheap-proxy

Hono proxy for Namecheap's XML API. Lives on Railway because Namecheap
requires whitelisted IPs and Vercel functions have dynamic egress IPs.
Railway gives the service a stable egress IP that we whitelist once.

Originally just an availability check (Decision 43). Extended to handle
the full auto-registration flow (Decision 49): pricing, domain create,
and DNS nameserver updates. Credentials stay on Railway; Vercel only
holds the proxy URL + a shared secret.

## Deploy on Railway

1. Create a new Railway service from this folder (`apps/namecheap-proxy`)
   — point the deploy at the monorepo and set the root directory to
   `apps/namecheap-proxy`.
2. Build command: `pnpm install`. Start command: `pnpm start`. Railway
   auto-detects `pnpm` from the root lockfile.
3. Set env vars:
   - `PROXY_SECRET` — long random string. Vercel sends this as
     `Authorization: Bearer <secret>`.
   - `NAMECHEAP_API_USER`
   - `NAMECHEAP_API_KEY`
   - `NAMECHEAP_USERNAME`
   - `NAMECHEAP_CLIENT_IP` — the Railway service's egress IP (see below)
   - `NAMECHEAP_SANDBOX=true` for sandbox testing, omit for production
4. After first deploy, grab the service's public URL — that's your
   `NAMECHEAP_PROXY_URL` for the Vercel app.

## Getting the Railway egress IP

Railway services don't display the egress IP directly. Easiest way:

```bash
# inside the service shell (or temporarily add a /ip endpoint)
curl ifconfig.me
```

Whitelist that IP in Namecheap → Profile → Tools → API Access → Manage.
Save. Test from Vercel.

## Endpoints

All POST endpoints require `Authorization: Bearer <PROXY_SECRET>`.

### `GET /` — health check

Returns `{ ok: true, service: 'namecheap-proxy' }`. Railway pings this.

### `POST /availability`

Body: `{ "domain": "joespizza.com" }`

Returns:
```json
{
  "available": true,
  "premium": false,
  "registration_price_usd": 11.06
}
```

The `registration_price_usd` field powers the funnel's $20 price gate
(Decision 49). Non-premium `.com` uses the cached 1-yr retail price from
`namecheap.users.getPricing` (5-min TTL); premium responses surface
Namecheap's `PremiumRegistrationPrice` instead. Returns `null` for the
price when we couldn't determine it — callers treat null as "unknown,
don't auto-buy."

### `POST /pricing`

Body: `{}` (no params today; always returns `.com` 1-yr registration).

Returns:
```json
{ "tld": "com", "registration_price_usd": 11.06 }
```

Used as a standalone check before manual operations; the same price is
also embedded in `/availability` so the funnel doesn't need an extra
round-trip.

### `POST /register`

Body:
```json
{
  "domain": "joespizza.com",
  "years": 1,
  "contact": {
    "firstName": "...",
    "lastName": "...",
    "address1": "...",
    "address2": "...",      // optional
    "city": "...",
    "stateProvince": "...",
    "postalCode": "...",
    "country": "US",
    "phone": "+1.5551234567",
    "emailAddress": "..."
  }
}
```

The contact block is mirrored to Registrant/Tech/Admin/AuxBilling under
the hood. Free WhoisGuard privacy is enabled on registration. Only `.com`
is accepted — other TLDs return `tld_not_supported`.

Success:
```json
{
  "registered": true,
  "domain": "joespizza.com",
  "years": 1,
  "charged_amount_usd": 11.06
}
```

Failure: `{ registered: false, error, namecheap_error_number, namecheap_error_message }`
with HTTP 502 when Namecheap returned an error code (insufficient funds,
domain unavailable, registrant validation, etc.). The orchestrator on
the Vercel side surfaces these to the admin alert email.

### `POST /dns/set-custom`

Body:
```json
{
  "domain": "joespizza.com",
  "nameservers": ["ns1.vercel-dns.com", "ns2.vercel-dns.com"]
}
```

Calls `namecheap.domains.dns.setCustom`. Used by the auto-provisioning
flow to point a freshly registered domain at Vercel's DNS (Vercel then
owns records + cert).

Success: `{ updated: true, domain, nameservers }`.

## Account funding

Namecheap deducts registration costs from your **Account Funds** balance
— there's no per-API-call CC charge. For auto-registration to work
hands-off, enable **auto top-up** in the Namecheap dashboard (Profile →
Tools → Account Funds → auto-fund settings). The Vercel-side feature
flag is off by default, so flipping the auto-register switch without
funding configured won't accidentally fail mid-flow.
