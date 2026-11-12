export const metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern use of StoopCraft — website builds, hosting, billing, and customer responsibilities.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">StoopCraft</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated June 2026</p>

        <div className="prose prose-gray prose-sm max-w-none space-y-8">

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">How the free build works</h2>
            <p className="text-gray-600">We design and build your website for free. You see the finished design first, and you owe nothing unless you decide to go live. There&apos;s no upfront cost and no obligation:</p>
            <ol className="mt-4 space-y-3">
              {[
                ['You tell us about your business', 'Share your details and we start designing — typically within 24 hours.'],
                ['We design & build it free', "You review the finished design at no cost. Want changes? We keep refining until it's right."],
                ['You go live — or walk away', "Love it? Go live for $99/mo. Don't? Walk away, nothing owed, no hard feelings."],
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
            <h2 className="text-base font-semibold text-gray-900 mb-3">What&apos;s included once you go live</h2>
            <p className="text-gray-600">Everything is bundled into one flat monthly price — $99/mo, no upfront fees:</p>
            <ul className="mt-4 list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Your custom-designed website, hosted on our platform</li>
              <li>Custom domain — you provide one or we register and manage one for you</li>
              <li>Mobile-first, responsive design on a global CDN</li>
              <li>SSL certificate and ongoing security updates</li>
              <li>Standard contact form and booking integration (Cal.com, Square, or Setmore)</li>
              <li>Unlimited content and edit requests</li>
              <li>SEO-ready page structure and meta tags</li>
              <li>Ongoing maintenance, hosting, and support — real people</li>
              <li>Priority email support, 24-hour response on business days</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">What&apos;s not included</h2>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Hand-edited HTML or CSS — for security and consistency we build and maintain the code ourselves</li>
              <li>Custom web applications or e-commerce checkout beyond standard integrations</li>
              <li>Email accounts at your domain (we host the website only)</li>
              <li>Paid marketing, advertising, or SEO campaign management</li>
              <li>Logo design (you provide the logo; we handle the visual direction around it)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Payment</h2>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>$0 upfront — you pay nothing until you approve the design and go live</li>
              <li>Once live, billed $99/mo in advance via Stripe</li>
              <li>All major credit and debit cards accepted</li>
              <li>No long-term contracts — cancel anytime</li>
              <li>Failed payments retry automatically over 14 days</li>
              <li>We do not pro-rate or refund unused time within a billing period</li>
              <li>If something is genuinely wrong on our end, we&apos;ll credit or refund at our discretion</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Acceptable use</h2>
            <p className="text-sm text-gray-600">We design and host websites for legitimate businesses. We reserve the right to decline service or take down content that promotes illegal activity, contains hate speech, infringes intellectual property, hosts malware, or is used to deceive customers. You are responsible for having the right to use any content you provide to us.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Ownership &amp; content</h2>
            <p className="text-sm text-gray-600">You own the content, logos, and brand assets you provide. While your subscription is active you have a license to the live site we build for you. The underlying design system, code, and platform remain ours. If you cancel, the site goes offline per our cancellation policy, but your own content remains yours.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Taking your website with you</h2>
            <p className="text-sm text-gray-600 mb-3">There is no upfront build fee — we design and develop your site before you pay anything, and the monthly price covers hosting, edits, and support rather than the build itself. So the website is not transferred by default. You can take it with you in either of these cases:</p>
            <ul className="text-sm text-gray-600 space-y-2 list-disc pl-5 mb-3">
              <li><span className="font-medium text-gray-800">You&apos;ve been with us 6 months or longer</span> — the build is considered paid for through your subscription, and we&apos;ll hand it over at no additional cost.</li>
              <li><span className="font-medium text-gray-800">You&apos;ve been with us less than 6 months</span> — a one-time design and development fee of $499 for Starter-plan sites. Pro and Business sites are quoted individually, since the build work is larger.</li>
            </ul>
            <p className="text-sm text-gray-600">A transfer means we give you the website files — pages, styles, images, and your content — so you can host them anywhere you like. It does not include our platform, admin editor, or the underlying design system, which remain ours. Your domain is separate and is never subject to this: see below.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Your domain is always yours</h2>
            <p className="text-sm text-gray-600">If you cancel, we transfer your domain to you at no cost, whatever your plan and however long you&apos;ve been with us. <span className="font-medium text-gray-800">The 6-month rule above applies only to the website itself, never to the domain.</span> If you brought your own domain, it was always yours and nothing changes. If we registered it for you, request the transfer within 60 days of cancelling and we&apos;ll move it to your registrar — after 60 days the registration lapses and the name may be claimed by anyone.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Uptime &amp; service levels</h2>
            <p className="text-sm text-gray-600">We target 99.9% uptime. We rely on third-party infrastructure (Vercel, Supabase, Cloudflare) — their outages affect our availability. Email support responds within 24 hours on business days. Site outages are monitored 24/7.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Limitation of liability</h2>
            <p className="text-sm text-gray-600">StoopCraft provides the service &quot;as is&quot; without warranties of any kind. Our liability for any claim is limited to fees paid in the prior 12 months. You&apos;re responsible for the legality of your content and business operations. Disputes resolved by arbitration.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Changes to these terms</h2>
            <p className="text-sm text-gray-600">We may update these terms with 30 days notice via email. Continued use of the service after that period constitutes acceptance.</p>
          </section>

          <section className="border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-500">Questions? Email us at <a href="mailto:hello@stoopcraft.com" className="underline text-gray-700">hello@stoopcraft.com</a></p>
          </section>

        </div>
      </div>
    </div>
  );
}
