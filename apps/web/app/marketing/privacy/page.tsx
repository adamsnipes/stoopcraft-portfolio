import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: { absolute: 'Privacy Policy — StoopCraft Marketing' },
  description:
    'How StoopCraft Marketing collects, uses, and protects the information you share when we run and manage your ad campaigns.',
  alternates: { canonical: '/marketing/privacy' },
  robots: { index: false },
};

const LOGO_SRC = '/stoopcraft-marketing-logo-v2.png';
const CONTACT_EMAIL = 'hello@stoopcraft.com';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold text-cream-50">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-cream-100/70">{children}</div>
    </section>
  );
}

export default function MarketingPrivacyPage() {
  return (
    <div className="min-h-screen bg-navy-950 text-cream-50">
      <header className="border-b border-navy-700/50 bg-navy-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/marketing" className="flex items-center">
            <Image
              src={LOGO_SRC}
              alt="StoopCraft Marketing"
              width={2172}
              height={724}
              priority
              className="h-10 w-auto"
              sizes="240px"
            />
          </Link>
          <Link href="/marketing" className="text-sm text-cream-100/60 hover:text-gold-400">
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-16">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gold-400">
          StoopCraft Marketing
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight text-cream-50">Privacy Policy</h1>
        <p className="mt-2 text-sm text-cream-100/40">Last updated July 2026</p>

        <div className="mt-12 space-y-10">
          <p className="text-sm leading-relaxed text-cream-100/70">
            StoopCraft Marketing builds, launches, and manages paid advertising campaigns for local
            businesses. This policy explains what information we collect, why we collect it, and how
            we handle it. Questions? Email us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold-400 underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>

          <Section title="Information we collect">
            <ul className="list-disc space-y-1.5 pl-5 marker:text-gold-400/60">
              <li>
                <span className="font-medium text-cream-50">Details you give us.</span> When you
                request your free trial or book a call, you share things like your name, email,
                phone number, and business name.
              </li>
              <li>
                <span className="font-medium text-cream-50">Advertising access &amp; assets.</span>{' '}
                To run your campaigns we may need access to your ad accounts (e.g. Meta Business /
                Google Ads), business pages, and the images, offers, and information you want us to
                advertise.
              </li>
              <li>
                <span className="font-medium text-cream-50">Campaign &amp; lead data.</span> We
                process the leads, calls, messages, and results your ads generate so we can report
                on and improve performance.
              </li>
              <li>
                <span className="font-medium text-cream-50">Billing.</span> If you continue past the
                trial, we store account details and payment information. Card details are handled by
                Stripe — we never see or store full card numbers.
              </li>
              <li>
                <span className="font-medium text-cream-50">Usage &amp; cookies.</span> We collect
                basic analytics and use cookies and advertising pixels (such as the Meta Pixel) to
                measure and improve campaign performance.
              </li>
            </ul>
          </Section>

          <Section title="How we use your information">
            <ul className="list-disc space-y-1 pl-5 marker:text-gold-400/60">
              <li>To build, launch, manage, and optimize your ad campaigns</li>
              <li>To contact you about your trial, results, and account</li>
              <li>To process payments and manage your subscription</li>
              <li>To measure performance and report leads, cost, and results back to you</li>
              <li>To improve our service and keep it secure</li>
            </ul>
            <p>
              We don&apos;t sell your personal information, and we don&apos;t use your business
              assets for anything other than running your advertising.
            </p>
          </Section>

          <Section title="Advertising platforms">
            <p>
              We manage campaigns on your behalf through third-party advertising platforms such as{' '}
              <span className="font-medium text-cream-50">Meta (Facebook &amp; Instagram)</span> and{' '}
              <span className="font-medium text-cream-50">Google</span>. Your use of those platforms
              is also governed by their own terms and privacy policies, and data shared with them to
              run your ads is subject to their handling.
            </p>
          </Section>

          <Section title="Service providers we share with">
            <p>
              We share data only with the providers that make the service work, under their own
              privacy and security obligations:
            </p>
            <ul className="list-disc space-y-1 pl-5 marker:text-gold-400/60">
              <li>
                <span className="font-medium text-cream-50">Meta &amp; Google</span> — ad delivery
                and campaign management
              </li>
              <li>
                <span className="font-medium text-cream-50">Stripe</span> — payment processing
              </li>
              <li>
                <span className="font-medium text-cream-50">CRM &amp; lead tools</span> — storing
                and routing the leads your ads generate
              </li>
              <li>
                <span className="font-medium text-cream-50">Email &amp; analytics providers</span> —
                transactional email and performance measurement
              </li>
              <li>
                <span className="font-medium text-cream-50">Hosting &amp; infrastructure</span> —
                running this site and our platform
              </li>
            </ul>
            <p>
              We may also disclose information if required by law or to protect our rights, users, or
              the public.
            </p>
          </Section>

          <Section title="Data retention">
            <p>
              We keep your information for as long as your account is active. If you cancel, we
              preserve your data for a 60-day grace period so you can reactivate, after which it is
              permanently deleted — except records we are required to keep for legal or accounting
              reasons.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              You can ask us to access, correct, export, or delete your personal information at any
              time by emailing{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold-400 underline">
                {CONTACT_EMAIL}
              </a>
              . Depending on where you live, you may have additional rights under laws such as the
              GDPR or CCPA — we honor those requests.
            </p>
          </Section>

          <Section title="Security">
            <p>
              We protect your data with encryption in transit (SSL), access controls, and reputable
              infrastructure providers. No system is perfectly secure, but we take reasonable
              measures to keep your information safe and will notify affected users of any breach as
              required by law.
            </p>
          </Section>

          <Section title="Children's privacy">
            <p>
              Our service is for businesses and is not directed at children under 13. We do not
              knowingly collect personal information from children.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this policy from time to time. Material changes will be communicated by
              email or a notice on our site, and the &quot;last updated&quot; date above will reflect
              the revision.
            </p>
          </Section>

          <div className="border-t border-navy-700/50 pt-6 text-sm text-cream-100/50">
            Questions about your privacy? Email us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold-400 underline">
              {CONTACT_EMAIL}
            </a>
            .
          </div>
        </div>
      </main>
    </div>
  );
}
