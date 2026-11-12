import { PRICING } from '@/lib/pricing';

export const metadata = {
  title: 'Cancellation Policy',
  description:
    'How to cancel a StoopCraft plan, what happens to your website and domain, and our refund terms.',
  alternates: { canonical: '/cancellation' },
};

export default function CancellationPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">StoopCraft</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Cancellation Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated April 2026</p>

        <div className="space-y-8">

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Cancel anytime, no questions asked</h2>
            <p className="text-sm text-gray-600 mb-4">You can cancel via your customer portal or by emailing us. Here&apos;s exactly what happens:</p>
            <ol className="space-y-3">
              {[
                ['You cancel', 'Via the portal or by emailing hello@stoopcraft.com.'],
                ['Subscription continues', 'Your site stays live until the end of your current billing period — you already paid for it.'],
                ['Site goes offline', 'At the end of the billing period, your site goes offline and your domain stops resolving.'],
                ['60-day grace period', 'Your data is preserved for 60 days. Re-subscribe anytime and your site comes back instantly.'],
                ['Permanent deletion', 'After 60 days, all your data is permanently and irreversibly deleted.'],
              ].map(([title, body], i) => (
                <li key={i} className="flex gap-4">
                  <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-gray-900 text-white text-xs font-semibold flex items-center justify-center">{i + 1}</span>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{title}</div>
                    <div className="text-sm text-gray-600">{body}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Reminder emails during your grace period</h2>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Day 30: &quot;Your site is preserved — click here to reactivate&quot;</li>
              <li>Day 55: &quot;We&apos;re deleting your data in 5 days&quot;</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Pause instead of cancel — {PRICING.pause.label}</h2>
            <p className="text-sm text-gray-600">If you&apos;re seasonal or temporarily stepping away, you can pause your subscription. Your domain stays registered and your data is preserved, but your site goes offline. Resume anytime by switching back to your regular plan.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">What happens to your domain</h2>
            <p className="text-sm text-gray-600 mb-3">Your domain goes with you when you cancel — always, on every plan, no matter how long you&apos;ve been with us.</p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li><span className="font-medium text-gray-800">You own the domain:</span> Nothing changes. Update your DNS to remove the connection to us and use it wherever you like.</li>
              <li><span className="font-medium text-gray-800">We registered it for you:</span> Request a transfer within 60 days of cancellation and we&apos;ll move it to you at no cost. After 60 days the registration lapses and the name may be claimed by anyone.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">What happens to your website</h2>
            <p className="text-sm text-gray-600 mb-3">The website is separate from the domain. We build it before you pay anything, and your monthly price covers hosting, edits, and support — not the build. So it isn&apos;t transferred by default when you cancel.</p>
            <ul className="text-sm text-gray-600 space-y-2 mb-3">
              <li><span className="font-medium text-gray-800">6 months or longer with us:</span> the build is paid for through your subscription. We hand over the website files at no additional cost.</li>
              <li><span className="font-medium text-gray-800">Less than 6 months:</span> a one-time design and development fee of $499 for Starter-plan sites. Pro and Business sites are quoted individually.</li>
            </ul>
            <p className="text-sm text-gray-600">Either way you get the pages, styles, images, and your content, ready to host anywhere. Our platform, admin editor, and design system aren&apos;t included. And you keep your content regardless — see the export section below.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Refunds</h2>
            <p className="text-sm text-gray-600">We don&apos;t pro-rate or refund unused time within a billing period. If something is genuinely wrong on our end — an extended outage, a mistake we made — we&apos;ll credit or refund at our discretion. Just email us.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Exporting your data</h2>
            <p className="text-sm text-gray-600">Your cancellation confirmation email includes a link to download all your content (text, photos, settings) as a JSON file. You can also request an export anytime from your customer portal.</p>
          </section>

          <section className="border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-500">Questions? Email us at <a href="mailto:hello@stoopcraft.com" className="underline text-gray-700">hello@stoopcraft.com</a></p>
          </section>

        </div>
      </div>
    </div>
  );
}
