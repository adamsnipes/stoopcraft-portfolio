export const metadata = {
  // Title must NOT repeat the brand: the root layout applies a
  // "%s — StoopCraft" template, so "Privacy Policy — StoopCraft" rendered as
  // "Privacy Policy — StoopCraft — StoopCraft".
  title: 'Privacy Policy',
  description:
    'How StoopCraft collects, uses and protects information across our website and the sites we build for customers.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">StoopCraft</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated June 2026</p>

        <div className="prose prose-gray prose-sm max-w-none space-y-8">

          <section>
            <p className="text-gray-600">StoopCraft designs and hosts websites for businesses. This policy explains what information we collect, why we collect it, and how we handle it. If you have questions, email us at <a href="mailto:hello@stoopcraft.com" className="underline text-gray-700">hello@stoopcraft.com</a>.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Information we collect</h2>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li><span className="font-medium text-gray-800">Details you give us.</span> When you request a free website, you share things like your name, email, phone number, business name, and the content you want on your site.</li>
              <li><span className="font-medium text-gray-800">Account &amp; billing.</span> If you go live, we store account details and payment information. Card details are handled by Stripe — we never see or store full card numbers.</li>
              <li><span className="font-medium text-gray-800">Usage data.</span> We collect basic analytics (pages visited, device, approximate location) to understand how our site and the sites we build perform.</li>
              <li><span className="font-medium text-gray-800">Cookies.</span> We use essential cookies to keep you signed in and analytics cookies to measure performance.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">How we use your information</h2>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>To design, build, host, and maintain your website</li>
              <li>To respond to your requests and provide support</li>
              <li>To process payments and manage your subscription</li>
              <li>To send service and account emails, and an optional performance summary</li>
              <li>To improve our service and keep it secure</li>
            </ul>
            <p className="mt-3 text-sm text-gray-600">We don&apos;t sell your personal information, and we don&apos;t use the content you give us for anything other than building and running your website.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Service providers we share with</h2>
            <p className="text-sm text-gray-600">We share data only with the providers that make the service work, under their own privacy and security obligations:</p>
            <ul className="mt-3 list-disc list-inside text-sm text-gray-600 space-y-1">
              <li><span className="font-medium text-gray-800">Vercel &amp; Cloudflare</span> — hosting and content delivery</li>
              <li><span className="font-medium text-gray-800">Supabase</span> — database and authentication</li>
              <li><span className="font-medium text-gray-800">Stripe</span> — payment processing</li>
              <li><span className="font-medium text-gray-800">Email &amp; analytics providers</span> — transactional email and usage measurement</li>
            </ul>
            <p className="mt-3 text-sm text-gray-600">We may also disclose information if required by law or to protect our rights, users, or the public.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Data retention</h2>
            <p className="text-sm text-gray-600">We keep your information for as long as your site is active. If you cancel, your site goes offline and your data is preserved for a 60-day grace period so you can reactivate. After 60 days it is permanently and irreversibly deleted, except records we are required to keep for legal or accounting reasons.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Your rights</h2>
            <p className="text-sm text-gray-600">You can ask us to access, correct, export, or delete your personal information at any time by emailing <a href="mailto:hello@stoopcraft.com" className="underline text-gray-700">hello@stoopcraft.com</a>. Depending on where you live, you may have additional rights under laws such as the GDPR or CCPA — we honor those requests.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Security</h2>
            <p className="text-sm text-gray-600">We protect your data with encryption in transit (SSL), access controls, and reputable infrastructure providers. No system is perfectly secure, but we take reasonable measures to keep your information safe and will notify affected users of any breach as required by law.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Children&apos;s privacy</h2>
            <p className="text-sm text-gray-600">Our service is for businesses and is not directed at children under 13. We do not knowingly collect personal information from children.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Changes to this policy</h2>
            <p className="text-sm text-gray-600">We may update this policy from time to time. Material changes will be communicated by email or a notice on our site, and the &quot;last updated&quot; date above will reflect the revision.</p>
          </section>

          <section className="border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-500">Questions about your privacy? Email us at <a href="mailto:hello@stoopcraft.com" className="underline text-gray-700">hello@stoopcraft.com</a></p>
          </section>

        </div>
      </div>
    </div>
  );
}
