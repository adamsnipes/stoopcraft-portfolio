import type { Metadata } from 'next';
import { CHEAP_BRAND } from '@/lib/marketing-brand';
import { cheapMetadata } from '../_components/brand';
import { LegalPage } from '../_components/legal';

export const metadata: Metadata = cheapMetadata({
  title: `Privacy Policy | ${CHEAP_BRAND.name}`,
  description: `How ${CHEAP_BRAND.name} collects, uses, and protects the information you share with us.`,
  path: '/privacy',
});

const mail = <a href={`mailto:${CHEAP_BRAND.email}`}>{CHEAP_BRAND.email}</a>;

export default function CheapPrivacyPage() {
  return <LegalPage title="Privacy Policy" updated="November 2026">
    <p>{CHEAP_BRAND.name} designs, hosts, and maintains websites for small businesses. This policy explains what information we collect, why, and how we handle it. Questions? Email {mail}.</p>

    <h2>Information we collect</h2>
    <ul>
      <li><strong>Details you give us.</strong> When you request a free preview, you share your name, email, business name, and optionally your phone number and type of business. If you go ahead, you also share the content you want on your website.</li>
      <li><strong>Billing.</strong> If you launch, payments are processed by Stripe. We never see or store full card numbers.</li>
      <li><strong>Usage data.</strong> We collect basic analytics, such as pages visited, device type, and approximate location, to understand how our site performs.</li>
      <li><strong>Cookies and advertising.</strong> We use analytics cookies and advertising pixels (such as Meta and Google) to measure our ads and learn which ones bring in inquiries.</li>
    </ul>

    <h2>How we use it</h2>
    <ul>
      <li>To follow up on your request and send your free preview</li>
      <li>To design, build, host, and maintain your website</li>
      <li>To process payments and manage your subscription</li>
      <li>To send service and account emails</li>
      <li>To improve our service and keep it secure</li>
    </ul>
    <p>We don’t sell your personal information. We don’t use the content you give us for anything other than building and running your website.</p>

    <h2>Who we share it with</h2>
    <p>We share data only with the providers that make the service work, under their own privacy and security obligations: hosting and content delivery, database, payment processing (Stripe), email delivery, customer-relationship tools, and analytics and advertising measurement. We may also disclose information if the law requires it or to protect our rights, users, or the public.</p>

    <h2>How long we keep it</h2>
    <p>If you request a preview and don’t launch, we keep your details only as long as needed to follow up, and delete them on request. If you launch, we keep your information while your website is active. After you cancel, your data is deleted after a 60-day grace period, except records we must keep for legal or accounting reasons.</p>

    <h2>Your rights</h2>
    <p>You can ask us to access, correct, export, or delete your personal information at any time by emailing {mail}. Depending on where you live, you may have additional rights under laws such as the GDPR or CCPA. We honor those requests.</p>

    <h2>Security</h2>
    <p>We protect your data with encryption in transit, access controls, and reputable infrastructure providers. No system is perfectly secure, but we take reasonable measures to keep your information safe and will notify affected users of a breach as the law requires.</p>

    <h2>Children</h2>
    <p>Our service is for businesses and is not directed at children under 13. We do not knowingly collect personal information from children.</p>

    <h2>Changes to this policy</h2>
    <p>We may update this policy from time to time. Material changes will be communicated by email or a notice on this site, and the date above will change.</p>
  </LegalPage>;
}
