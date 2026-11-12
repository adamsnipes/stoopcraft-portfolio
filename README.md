# StoopCraft

A website-management platform for local businesses. An operator can manage client sites, content changes, subscriptions, custom domains, lead notifications, and AI-assisted website generation from one dashboard.

## Engineering highlights

- Next.js administration and customer-facing routes share a typed application layer.
- Supabase/PostgreSQL stores client data; row-level security and tenant-isolation tests exercise access boundaries.
- Cloudflare R2 stores static website bundles and assets; host routing serves individual sites.
- Stripe billing, email notifications, and optional CRM forwarding support the client lifecycle.
- Unit tests cover billing decisions, cancellation, HTML sanitization, branding, and site management.

## Stack

TypeScript · React / Next.js · Supabase / PostgreSQL · Cloudflare R2 · Stripe · Anthropic · Vitest

## Explore locally

```bash
pnpm install
cp .env.example apps/web/.env.local
# Configure your own local Supabase instance and any optional service credentials.
pnpm dev
```

Database definitions are in `supabase/migrations/`; application code is in `apps/web/`; shared database types are in `packages/db/`.

```bash
pnpm exec vitest run tests/unit
pnpm typecheck
```

This portfolio edition omits client website sources, client assets, operational notes, marketing archives, and original Git history. `demo/clients.json` contains explicitly fictional examples and is not applied automatically. CRM forwarding has no embedded token and stays disabled until you provide a webhook URL. Some marketing links/images reference omitted content. A fully configured deployment is not included.
