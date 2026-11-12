import type { ReactNode } from 'react';
import { Block, Copy, Gotcha, M, Record } from './SopBits';

/**
 * The onboarding SOP, as data.
 * ----------------------------------------------------------------------------
 * Deliberately short: the four things that get forgotten when a new client goes
 * live. Build/design rules are not here — they live in `website_rules.md` and
 * `SEO_RULES.md`.
 *
 * Editing rules:
 *  - `id` on a step is a storage key. Never reuse or renumber an existing id —
 *    changing it silently un-ticks that step for every in-flight onboarding.
 *  - One action per step. If it needs explaining, that goes in `body`.
 */

export type SopStep = {
  /** Stable storage key. Never change once shipped. */
  id: string;
  title: ReactNode;
  body?: ReactNode;
  /** Only applies to some clients. */
  optional?: boolean;
};

export type SopSection = {
  id: string;
  title: string;
  purpose: string;
  steps: SopStep[];
};

export type SopConfig = {
  /** Vercel project apex A record — the value clients point `@` at. */
  aRecord: string | null;
  /** Vercel project CNAME target — the value clients point `www` at. */
  cname: string | null;
  /** Service account that must be a user on every GSC property. */
  gscServiceAccount: string | null;
};

export function buildSections(cfg: SopConfig): SopSection[] {
  const A = cfg.aRecord ?? '<VERCEL_PROJECT_A_RECORD not set>';
  const CN = cfg.cname ?? '<VERCEL_PROJECT_CNAME not set>';

  return [
    /* ---------------------------------------------------------------- */
    {
      id: 'domain',
      title: 'Domain',
      purpose: 'Point the domain at the platform and get a cert.',
      steps: [
        {
          id: 'domain.register',
          title: 'We register it: buy in Namecheap (WHOIS Privacy + auto-renew on), set nameservers to Vercel.',
          optional: true,
          body: (
            <>
              <div className="flex flex-wrap gap-2">
                <Copy value="ns1.vercel-dns.com" />
                <Copy value="ns2.vercel-dns.com" />
              </div>
              <Gotcha>
                Delegating nameservers replaces every DNS record for the domain. If it already
                receives email, capture the existing MX/TXT records first and re-create them in
                Vercel DNS (§2).
              </Gotcha>
            </>
          ),
        },
        {
          id: 'domain.records',
          title: 'Client registers it: send them these two records to add at their registrar.',
          optional: true,
          body: (
            <>
              <div className="space-y-1">
                <Record type="A" host="@" value={A} />
                <Record type="CNAME" host="www" value={CN} />
              </div>
              <p>
                These are this project&apos;s targets, not the generic values in Vercel&apos;s docs.
                Nothing else about their DNS changes — existing email keeps working.
              </p>
            </>
          ),
        },
        {
          id: 'domain.save',
          title: 'Client page → Domain card: type the domain, pick the owner, Save.',
          body: (
            <p>
              Apex only — no <M>https://</M>, no <M>www</M>. Save before Add to Vercel: the Vercel
              call reads <M>custom_domain</M> off the saved row.
            </p>
          ),
        },
        {
          id: 'domain.vercel',
          title: 'Click Add to Vercel and wait for the badge to read Live.',
          body: (
            <p>
              If it comes back with verification records, DNS hasn&apos;t propagated yet — wait and
              click again, it&apos;s idempotent. <strong>Check DNS</strong> polls for you.
            </p>
          ),
        },
        {
          id: 'domain.confirm',
          title: 'Visit the domain in a browser. The site should load, with a padlock.',
          body: <p>Check www too — it should redirect to the apex, not error.</p>,
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    {
      id: 'email',
      title: 'Business email (Google Workspace)',
      purpose: 'Only when the client wants name@theirdomain.com.',
      steps: [
        {
          id: 'email.txt',
          title: 'Client sends us the TXT verification record from their Workspace setup.',
        },
        {
          id: 'email.dns',
          title: 'Add the TXT wherever the DNS lives.',
          body: (
            <p>
              <strong>We own the DNS</strong> (nameservers at Vercel): Vercel → the project →
              Settings → Domains → the domain → DNS → Add record. <strong>They own it</strong>: send
              it back and let them add it at their registrar.
            </p>
          ),
        },
        {
          id: 'email.mx',
          title: 'Add the MX record, same place.',
          body: (
            <>
              <Record type="MX" host="@" value="smtp.google.com" />
              <p>
                Priority <M>1</M>. That&apos;s all mail needs to start flowing. Delete any leftover
                registrar/parking MX records — a stray one quietly swallows some of their mail.
              </p>
            </>
          ),
        },
        {
          id: 'email.confirm',
          title: 'Confirm: Workspace shows the domain verified, and a test email goes both ways.',
          body: (
            <>
              <Block code={`dig +short MX example.com`} />
              <p>
                Allow up to an hour. SPF/DKIM/DMARC are deliverability extras, not requirements —
                add them only if their mail starts landing in spam.
              </p>
            </>
          ),
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    {
      id: 'gsc',
      title: 'Google Search Console',
      purpose: 'After the domain is live — verification checks the real domain.',
      steps: [
        {
          id: 'gsc.property',
          title: 'Add the property and verify it.',
          body: (
            <p>
              We control the DNS → <strong>Domain property</strong> (TXT record, covers apex + www).
              They control it → <strong>URL-prefix property</strong> and verify with the{' '}
              <M>google-site-verification</M> meta tag, which every site already carries.
            </p>
          ),
        },
        {
          id: 'gsc.sitemap',
          title: (
            <>
              Sitemaps → submit <M>sitemap.xml</M>.
            </>
          ),
        },
        {
          id: 'gsc.serviceaccount',
          title: 'Settings → Users and permissions → add the reporting account as Full.',
          body: cfg.gscServiceAccount ? <Copy value={cfg.gscServiceAccount} /> : null,
        },
        {
          id: 'gsc.link',
          title: 'Admin → client → SEO → pick the property → Save.',
          body: <p>Without this the reporting account has nothing to read.</p>,
        },
      ],
    },

    /* ---------------------------------------------------------------- */
    {
      id: 'ga4',
      title: 'Google Analytics 4',
      purpose: 'One property per client.',
      steps: [
        {
          id: 'ga4.property',
          title: 'analytics.google.com → Admin → Create property. Fill in the business details, timezone and currency.',
        },
        {
          id: 'ga4.stream',
          title: (
            <>
              Add a <strong>Web</strong> data stream for the domain → copy the measurement ID (
              <M>G-XXXXXXXXXX</M>).
            </>
          ),
        },
        {
          id: 'ga4.tag',
          title: 'Give the ID to Claude to add the tag to the site.',
          body: <p>It goes in the head of every page, not just the homepage.</p>,
        },
        {
          id: 'ga4.upload',
          title: 'Rebuild the zip and re-upload it on the client page.',
        },
        {
          id: 'ga4.confirm',
          title: 'Confirm in GA4 Realtime: load the site and watch yourself appear.',
        },
      ],
    },
  ];
}
