import type { Metadata } from 'next';
import { CHEAP_BRAND } from '@/lib/marketing-brand';
import { cheapMetadata } from '../_components/brand';
import { LegalPage } from '../_components/legal';

export const metadata: Metadata = cheapMetadata({
  title: `Terms of Service | ${CHEAP_BRAND.name}`,
  description: `The terms for ${CHEAP_BRAND.name} website builds, hosting, billing, and updates.`,
  path: '/terms',
});

const price = `$${CHEAP_BRAND.monthly}/month`;

export default function CheapTermsPage() {
  return <LegalPage title="Terms of Service" updated="November 2026">
    <h2>How the free preview works</h2>
    <p>Tell us about your business and we design a website preview for free. You review it and request changes. You owe nothing unless you choose to launch. No card is needed to preview.</p>

    <h2>What’s included</h2>
    <p>Once you launch, one flat price of {price} covers:</p>
    <ul>
      <li>A professional business landing page, designed and written for you</li>
      <li>Hosting and SSL security</li>
      <li>Connecting a domain you already own</li>
      <li>A mobile-friendly layout, click-to-call buttons, and a contact form</li>
      <li>Text and photo updates you send us</li>
      <li>Basic page titles and search metadata</li>
    </ul>

    <h2>What’s not included</h2>
    <ul>
      <li>Online stores, checkout, or custom web applications</li>
      <li>Full redesigns or additional pages beyond the landing page (we can quote these separately)</li>
      <li>Domain registration fees, if you need a new domain (confirmed with you before we register anything)</li>
      <li>Email accounts at your domain</li>
      <li>Paid advertising or SEO campaign management</li>
      <li>Logo design</li>
    </ul>

    <h2>Payment</h2>
    <ul>
      <li>$0 upfront. Billing starts when you approve your website and launch.</li>
      <li>{price}, billed monthly in advance through Stripe</li>
      <li>No minimum term. Cancel anytime.</li>
      <li>Failed payments are retried automatically. If payment can’t be collected, your website may be taken offline.</li>
      <li>We don’t pro-rate or refund unused time within a billing period. If something is genuinely wrong on our end, we’ll credit or refund at our discretion.</li>
      <li>We’ll give you at least 30 days’ notice by email before any price change.</li>
    </ul>

    <h2>Cancelling</h2>
    <p>If you cancel, your website stays online until the end of your paid billing period, then goes offline. Any options for transferring your website files are confirmed with you in writing before launch.</p>

    <h2>Your domain is yours</h2>
    <p>If you bring your own domain, it stays yours and nothing about it changes. If we register a new domain for you, we’ll confirm the cost and ownership details before registering it.</p>

    <h2>Acceptable use</h2>
    <p>We build websites for legitimate businesses. We may decline service or remove content that promotes illegal activity, contains hate speech, infringes intellectual property, hosts malware, or is used to deceive customers. You are responsible for having the right to use any content you give us.</p>

    <h2>Ownership</h2>
    <p>You own the content, logos, and brand assets you provide. While your subscription is active, you have a license to the website we build for you. Our underlying design system, code, and hosting platform remain ours.</p>

    <h2>Service availability</h2>
    <p>We aim to keep your website online at all times, but we rely on third-party infrastructure, and their outages can affect availability. We respond to support emails within one business day.</p>

    <h2>Limitation of liability</h2>
    <p>The service is provided “as is”, without warranties of any kind. Our liability for any claim is limited to the fees you paid in the prior 12 months. You are responsible for the legality of your content and business operations.</p>

    <h2>Changes to these terms</h2>
    <p>We may update these terms with 30 days’ notice by email. Continuing to use the service after that period means you accept the changes.</p>

    <p>Questions? Email <a href={`mailto:${CHEAP_BRAND.email}`}>{CHEAP_BRAND.email}</a>.</p>
  </LegalPage>;
}
