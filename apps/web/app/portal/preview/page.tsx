import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getAuthenticatedClient } from '@/lib/tenant';
import Link from 'next/link';

export const metadata: Metadata = { title: "Preview My Site" };

export default async function PreviewPage() {
  const ctx = await getAuthenticatedClient();
  if (!ctx) return null;

  const { client } = ctx;

  // Mirror admin's preview routing: on localhost there's no DNS for the
  // tenant subdomain (and frame-ancestors on the prod site blocks localhost
  // parents anyway), so point the iframe at /sites/{host} on the same origin.
  // On prod, hit the real subdomain so the customer sees their actual URL.
  const headersList = await headers();
  const requestHost = headersList.get('host') ?? '';
  const isLocal =
    requestHost.startsWith('localhost') || requestHost.startsWith('127.0.0.1');
  const platformDomain = process.env.PLATFORM_DOMAIN ?? 'localhost:3000';
  const customerHost =
    client.custom_domain ?? `${client.slug}.${platformDomain}`;
  const siteUrl = isLocal
    ? `http://${requestHost}/sites/${encodeURIComponent(customerHost)}`
    : `https://${customerHost}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Preview</h1>
          <p className="text-sm text-gray-400 mt-0.5">This is exactly what your customers see</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/portal/request"
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-white transition-all"
          >
            Request a change
          </Link>
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            Open in new tab
            <svg className="w-3.5 h-3.5" viewBox="0 0 12 12" fill="none">
              <path d="M2 10L10 2M10 2H5M10 2v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>

      {/* Browser chrome */}
      <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <div className="w-3 h-3 rounded-full bg-gray-300" />
            <div className="w-3 h-3 rounded-full bg-gray-300" />
          </div>
          <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200">
            {siteUrl}
          </div>
        </div>
        <iframe
          src={siteUrl}
          className="w-full"
          style={{ height: '72vh' }}
          title="Your website"
        />
      </div>
    </div>
  );
}
