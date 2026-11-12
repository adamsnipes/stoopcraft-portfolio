'use client';

import { useState } from 'react';
import { PRICING } from '@/lib/pricing';

type Plan = 'starter' | 'biweekly' | 'setup' | 'setup_plus_maintenance' | 'maintenance' | 'sms';

const PLAN_LABELS: Record<Plan, string> = {
  starter: `Starter — ${PRICING.starter.label}`,
  biweekly: `Biweekly — ${PRICING.biweekly.label}`,
  setup: `Setup only — ${PRICING.setup.label} one-time`,
  setup_plus_maintenance: `Setup + Maintenance — ${PRICING.setup.label} + ${PRICING.maintenance.label}`,
  maintenance: `Maintenance only — ${PRICING.maintenance.label}`,
  sms: `Lead texts add-on — ${PRICING.sms.label}`,
};

// Plans that have a branded /pay/[id] checkout page.
type BrandedPlan = 'starter' | 'biweekly' | 'sms';
const BRANDED_PLAN_LABELS: Record<BrandedPlan, string> = {
  starter: `Starter — ${PRICING.starter.label}`,
  biweekly: `Biweekly — ${PRICING.biweekly.label}`,
  sms: `Starter + SMS — ${PRICING.sms.label}`,
};

export function PaymentLinkPanel({
  clientId,
  defaultPhone,
}: {
  clientId: string;
  defaultPhone: string | null;
}) {
  const [plan, setPlan] = useState<Plan>('setup');
  const [phone, setPhone] = useState(defaultPhone ?? '');
  const [generating, setGenerating] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [smsStatus, setSmsStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  // Branded /pay/[id] checkout page — deterministic URL, built client-side.
  // 'starter' uses the bare URL; other branded plans carry ?plan=.
  const [pagePlan, setPagePlan] = useState<BrandedPlan>('starter');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const brandedUrl =
    pagePlan === 'starter'
      ? `${origin}/pay/${clientId}`
      : `${origin}/pay/${clientId}?plan=${pagePlan}`;
  const [pageCopied, setPageCopied] = useState(false);
  const [pageSending, setPageSending] = useState(false);
  const [pageSmsStatus, setPageSmsStatus] = useState<string | null>(null);

  async function handleSendPageLink() {
    setPageSmsStatus(null);
    setPageSending(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: pagePlan, link_type: 'page', phone, send_sms: true }),
      });
      const data = (await res.json()) as { error?: string; sms?: { ok: boolean; error?: string } };
      if (!res.ok) {
        setPageSmsStatus(`Failed: ${data.error ?? 'unknown'}`);
        return;
      }
      setPageSmsStatus(data.sms?.ok ? `Sent to ${phone}` : `SMS failed: ${data.sms?.error ?? 'unknown'}`);
    } catch (err) {
      setPageSmsStatus(`Failed: ${err instanceof Error ? err.message : 'network_error'}`);
    } finally {
      setPageSending(false);
    }
  }

  async function handleCopyPage() {
    await navigator.clipboard.writeText(brandedUrl);
    setPageCopied(true);
    setTimeout(() => setPageCopied(false), 2000);
  }

  async function handleGenerate(sendSms: boolean) {
    setError(null);
    setSmsStatus(null);
    if (sendSms) {
      setSending(true);
    } else {
      setGenerating(true);
    }

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, phone: sendSms ? phone : undefined, send_sms: sendSms }),
      });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        sms?: { ok: boolean; error?: string };
      };
      if (!res.ok || !data.url) {
        setError(data.error ?? 'failed');
        return;
      }
      setLink(data.url);
      if (sendSms) {
        setSmsStatus(data.sms?.ok ? `Sent to ${phone}` : `SMS failed: ${data.sms?.error ?? 'unknown'}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network_error');
    } finally {
      setGenerating(false);
      setSending(false);
    }
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-xl border border-ink-900/10 p-6 mb-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <h2 className="font-display text-lg font-medium mb-4">Send payment link</h2>

      {/* Branded Starter checkout page — the professional link to text customers. */}
      <div className="mb-5 rounded-xl border border-amber-accent/30 bg-amber-accent/[0.06] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-700">
            Branded checkout page
          </span>
          <select
            value={pagePlan}
            onChange={(e) => {
              setPagePlan(e.target.value as BrandedPlan);
              setPageSmsStatus(null);
            }}
            className="border border-ink-900/10 rounded-lg px-2 py-1 text-xs bg-white"
          >
            {(Object.keys(BRANDED_PLAN_LABELS) as BrandedPlan[]).map((p) => (
              <option key={p} value={p}>
                {BRANDED_PLAN_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={brandedUrl}
            className="flex-1 border border-ink-900/10 rounded-lg px-3 py-2 text-xs bg-white font-mono truncate"
          />
          <button
            type="button"
            onClick={handleCopyPage}
            className="border border-ink-900/10 rounded-lg px-4 py-2 text-sm hover:bg-ink-900/5 whitespace-nowrap transition-colors bg-white"
          >
            {pageCopied ? 'Copied!' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={handleSendPageLink}
            disabled={pageSending || !phone.trim()}
            className="bg-amber-accent text-ink-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-accent-soft disabled:opacity-50 whitespace-nowrap transition-colors"
          >
            {pageSending ? 'Sending…' : 'Send via SMS'}
          </button>
        </div>
        {pageSmsStatus && (
          <p className={`text-xs mt-2 ${pageSmsStatus.startsWith('Sent') ? 'text-emerald-700' : 'text-red-700'}`}>
            {pageSmsStatus}
          </p>
        )}
        <p className="text-xs text-ink-700/60 mt-2">
          Uses the phone below. Customer picks email + domain on Stripe.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-700">Plan</span>
          <select
            value={plan}
            onChange={(e) => {
              setPlan(e.target.value as Plan);
              setLink(null);
              setSmsStatus(null);
            }}
            className="mt-1 block w-full border border-ink-900/10 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {(Object.keys(PLAN_LABELS) as Plan[]).map((p) => (
              <option key={p} value={p}>
                {PLAN_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-700">Phone (for SMS)</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
            className="mt-1 block w-full border border-ink-900/10 rounded-lg px-3 py-2 text-sm bg-white font-mono"
          />
        </label>

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleGenerate(false)}
            disabled={generating || sending}
            className="bg-ink-900 text-cream-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink-800 disabled:opacity-50 transition-colors"
          >
            {generating ? 'Generating…' : 'Generate link'}
          </button>
          <button
            type="button"
            onClick={() => handleGenerate(true)}
            disabled={generating || sending || !phone.trim()}
            className="bg-amber-accent text-ink-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-accent-soft disabled:opacity-50 transition-colors"
          >
            {sending ? 'Sending…' : 'Generate & send via SMS'}
          </button>
        </div>

        {error && <p className="text-sm text-red-700">Error: {error}</p>}

        {link && (
          <div className="pt-3 border-t border-ink-900/10">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link}
                className="flex-1 border border-ink-900/10 rounded-lg px-3 py-2 text-xs bg-cream-50 font-mono truncate"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="border border-ink-900/10 rounded-lg px-4 py-2 text-sm hover:bg-ink-900/5 whitespace-nowrap transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            {smsStatus && (
              <p className={`text-xs mt-2 ${smsStatus.startsWith('Sent') ? 'text-emerald-700' : 'text-red-700'}`}>
                {smsStatus}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
