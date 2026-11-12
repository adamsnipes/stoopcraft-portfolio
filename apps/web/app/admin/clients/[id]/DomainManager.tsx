'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Owner = 'platform' | 'client';

type DomainStatus = 'unset' | 'pending' | 'live';

type RecordStatus = 'match' | 'wrong' | 'missing';

type RecordCheck = {
  status: RecordStatus;
  resolved: string[];
  expected: string;
};

type DnsCheck = { apex: RecordCheck; www: RecordCheck };

type VerificationRecord = {
  type: string;
  domain: string;
  value: string;
  reason: string;
};

type Props = {
  clientId: string;
  initialDomain: string | null;
  initialOwner: Owner;
  status: DomainStatus;
  lastVerification: VerificationRecord[] | null;
  projectCname: string | null;
  projectARecord: string | null;
};

const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="font-mono text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded px-2 py-1 text-gray-700"
    >
      {value} {copied ? '✓' : '⎘'}
    </button>
  );
}

export function DomainManager({
  clientId,
  initialDomain,
  initialOwner,
  status,
  lastVerification,
  projectCname,
  projectARecord,
}: Props) {
  const router = useRouter();
  const [domain, setDomain] = useState(initialDomain ?? '');
  const [owner, setOwner] = useState<Owner>(initialOwner);
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [verification, setVerification] = useState<VerificationRecord[] | null>(lastVerification);
  const [dnsCheck, setDnsCheck] = useState<DnsCheck | null>(null);
  const [polling, setPolling] = useState(false);
  const pollAbortRef = useRef<AbortController | null>(null);

  // Cleanup any in-flight poll loop when unmounting
  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
    };
  }, []);

  const trimmed = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const isValid = DOMAIN_RE.test(trimmed);
  const isDirty = trimmed !== (initialDomain ?? '') || owner !== initialOwner;

  const statusBadge = {
    unset: { label: 'Not configured', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
    pending: { label: 'Pending DNS', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
    live: { label: 'Live', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  }[status];

  async function handleSave() {
    if (!isValid) {
      setMessage({ kind: 'err', text: 'Enter a valid domain (e.g. joesbarber.com)' });
      return;
    }
    setSaving(true);
    setMessage(null);

    const res = await fetch(`/api/admin/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ custom_domain: trimmed, domain_owner: owner }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setMessage({ kind: 'err', text: `Save failed: ${body.error ?? res.statusText}` });
      return;
    }

    setMessage({ kind: 'ok', text: 'Saved.' });
    router.refresh();
  }

  async function handleAddToVercel() {
    setProvisioning(true);
    setMessage(null);

    const res = await fetch(`/api/admin/clients/${clientId}/domain`, { method: 'POST' });
    const body = await res.json().catch(() => ({})) as {
      success?: boolean;
      verified?: boolean;
      verification?: VerificationRecord[];
      error?: string;
      detail?: string;
    };

    setProvisioning(false);

    if (!res.ok) {
      setMessage({ kind: 'err', text: `Vercel error: ${body.detail ?? body.error ?? res.statusText}` });
      return;
    }

    if (body.verified) {
      setMessage({ kind: 'ok', text: 'Verified. Domain is live.' });
      setVerification(null);
    } else {
      setMessage({
        kind: 'err',
        text: 'Domain added but DNS not yet resolving. See verification records below.',
      });
      setVerification(body.verification ?? null);
    }
    router.refresh();
  }

  async function handleRemove() {
    if (!confirm(`Remove ${initialDomain} from this client and detach from Vercel?`)) return;
    setRemoving(true);
    setMessage(null);

    const res = await fetch(`/api/admin/clients/${clientId}/domain`, { method: 'DELETE' });

    setRemoving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setMessage({ kind: 'err', text: `Remove failed: ${body.error ?? res.statusText}` });
      return;
    }

    setDomain('');
    setVerification(null);
    setDnsCheck(null);
    setMessage({ kind: 'ok', text: 'Removed.' });
    router.refresh();
  }

  // Poll the DNS check endpoint every 3s for up to ~30s, or stop early when
  // both records match. Cancellable so unmounts and "check again" don't leak.
  async function handleCheckDns() {
    pollAbortRef.current?.abort();
    const ctrl = new AbortController();
    pollAbortRef.current = ctrl;
    setPolling(true);
    setMessage(null);

    const start = Date.now();
    const maxMs = 30_000;

    while (!ctrl.signal.aborted) {
      const res = await fetch(`/api/admin/clients/${clientId}/domain/check`, {
        signal: ctrl.signal,
      }).catch(() => null);

      if (!res) break;

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; detail?: string };
        setMessage({ kind: 'err', text: `Check failed: ${body.detail ?? body.error ?? res.statusText}` });
        break;
      }

      const result = await res.json() as DnsCheck;
      setDnsCheck(result);

      if (result.apex.status === 'match' && result.www.status === 'match') {
        setMessage({ kind: 'ok', text: 'DNS resolves correctly. Click Add to Vercel to provision the cert.' });
        break;
      }

      if (Date.now() - start > maxMs) {
        setMessage({
          kind: 'err',
          text: 'DNS not yet resolving. Records can take a few minutes to propagate; try again shortly.',
        });
        break;
      }

      await new Promise((r) => setTimeout(r, 3000));
    }

    setPolling(false);
  }

  function recordIcon(s: RecordStatus) {
    if (s === 'match') return <span className="text-emerald-600">✓</span>;
    if (s === 'wrong') return <span className="text-red-600">✗</span>;
    return <span className="text-gray-400">—</span>;
  }

  function recordLabel(s: RecordStatus) {
    if (s === 'match') return 'matches';
    if (s === 'wrong') return 'wrong target';
    return 'not set';
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${statusBadge.cls}`}
        >
          {statusBadge.label}
        </span>
        {initialDomain && (
          <a
            href={`https://${initialDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-ink-700 hover:text-ink-900 underline"
          >
            {initialDomain} ↗
          </a>
        )}
      </div>

      {/* Onboarding cheatsheet */}
      <details className="rounded-lg bg-ink-900/[0.02] border border-ink-900/10 text-xs">
        <summary className="cursor-pointer px-3 py-2 font-semibold text-ink-700 hover:text-ink-900 select-none">
          How to onboard a custom domain
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-3 text-ink-700">
          <div>
            <div className="font-semibold text-ink-900 mb-1">Client owns the domain</div>
            <ol className="list-decimal list-inside space-y-1 marker:text-ink-700/40">
              <li>Send the customer the DNS records below (apex A + www CNAME). They set them at their registrar.</li>
              <li>In this card: type the domain, select <strong>Client</strong>, click <strong>Save</strong>.</li>
              <li>Click <strong>Check DNS</strong>. Wait until both rows show ✓.</li>
              <li>Click <strong>Add to Vercel</strong>. Cert provisions in ~5–15s; status flips to <strong>Live</strong>.</li>
              <li>If <strong>Add to Vercel</strong> returns verification records, DNS hasn&apos;t propagated yet — wait, then click again (it&apos;s idempotent).</li>
            </ol>
          </div>
          <div>
            <div className="font-semibold text-ink-900 mb-1">We register the domain</div>
            <ol className="list-decimal list-inside space-y-1 marker:text-ink-700/40">
              <li>Buy in Namecheap, enable WHOIS Privacy + auto-renew.</li>
              <li>In Namecheap, set nameservers to <code className="font-mono">ns1.vercel-dns.com</code> and <code className="font-mono">ns2.vercel-dns.com</code>.</li>
              <li>In this card: type the domain, select <strong>Platform</strong>, click <strong>Save</strong>.</li>
              <li>Click <strong>Add to Vercel</strong>. Cert provisions automatically.</li>
            </ol>
          </div>
          <div className="text-ink-700/70 pt-1 border-t border-ink-900/5">
            <strong>Order matters:</strong> Save before Add to Vercel — the Vercel call reads <code className="font-mono">custom_domain</code> from the DB row.
          </div>
        </div>
      </details>

      {/* Domain input */}
      <div>
        <label className="block text-xs font-semibold text-ink-700 mb-1.5">Domain</label>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="joesbarber.com"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full border border-ink-900/15 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-ink-900/40"
        />
        <p className="text-xs text-ink-700/60 mt-1">
          Apex only (e.g. joesbarber.com). No protocol, no path. Add to Vercel provisions certs for
          both the apex and www — www is redirected to the apex.
        </p>
      </div>

      {/* Owner */}
      <div>
        <label className="block text-xs font-semibold text-ink-700 mb-1.5">Owner</label>
        <div className="flex gap-3">
          {(['platform', 'client'] as const).map((o) => (
            <label
              key={o}
              className={`flex-1 cursor-pointer border rounded-lg px-3 py-2.5 text-sm transition-colors ${
                owner === o ? 'border-ink-900 bg-ink-900/[0.03]' : 'border-ink-900/10 hover:border-ink-900/20'
              }`}
            >
              <input
                type="radio"
                name="domain_owner"
                value={o}
                checked={owner === o}
                onChange={() => setOwner(o)}
                className="sr-only"
              />
              <div className="font-medium">
                {o === 'platform' ? 'Platform (we registered it)' : 'Client (customer registered it)'}
              </div>
              <div className="text-xs text-ink-700/60 mt-0.5">
                {o === 'platform'
                  ? 'WHOIS watchdog will track renewal'
                  : 'Customer manages their own renewal'}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* DNS hint */}
      <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-3 text-xs text-blue-900 space-y-1.5">
        <div className="font-semibold">DNS setup</div>
        {owner === 'platform' ? (
          <div>
            In Namecheap, set nameservers to:
            <div className="flex gap-2 mt-1.5">
              <CopyValue value="ns1.vercel-dns.com" />
              <CopyValue value="ns2.vercel-dns.com" />
            </div>
            <div className="text-blue-900/70 mt-1.5">
              Vercel will auto-create wildcard ALIAS records pointing at this project.
            </div>
          </div>
        ) : projectCname && projectARecord ? (
          <div>
            Have the customer add these records at their registrar (apex domain):
            <div className="mt-1.5 space-y-1">
              <div>
                <span className="inline-block w-12">A</span>
                <code className="font-mono">@</code> → <CopyValue value={projectARecord} />
              </div>
              <div>
                <span className="inline-block w-12">CNAME</span>
                <code className="font-mono">www</code> → <CopyValue value={projectCname} />
              </div>
            </div>
            <div className="text-blue-900/70 mt-1.5">
              These are this Vercel project&apos;s specific targets — different from the generic
              Vercel docs values. After they&apos;re live, click <strong>Add to Vercel</strong>.
            </div>
          </div>
        ) : (
          <div className="text-blue-900/80">
            <strong>VERCEL_PROJECT_CNAME</strong> and <strong>VERCEL_PROJECT_A_RECORD</strong>{' '}
            env vars not set. Find them in the Vercel dashboard → your project → Settings →
            Domains. Until then, click <strong>Add to Vercel</strong> first and Vercel will
            return the verification records to forward to the customer.
          </div>
        )}
      </div>

      {/* DNS check result */}
      {dnsCheck && initialDomain && (
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs space-y-2">
          <div className="font-semibold text-gray-700 flex items-center gap-2">
            DNS check{polling && <span className="text-gray-500 font-normal">(checking…)</span>}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="w-4 shrink-0 text-center">{recordIcon(dnsCheck.apex.status)}</span>
              <div className="flex-1 font-mono text-gray-700">
                A <span className="text-gray-500">{initialDomain}</span> →{' '}
                {dnsCheck.apex.resolved.length > 0
                  ? dnsCheck.apex.resolved.join(', ')
                  : recordLabel(dnsCheck.apex.status)}
                {dnsCheck.apex.status !== 'match' && (
                  <span className="text-gray-500"> · expected {dnsCheck.apex.expected}</span>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 shrink-0 text-center">{recordIcon(dnsCheck.www.status)}</span>
              <div className="flex-1 font-mono text-gray-700">
                CNAME <span className="text-gray-500">www.{initialDomain}</span> →{' '}
                {dnsCheck.www.resolved.length > 0
                  ? dnsCheck.www.resolved.join(', ')
                  : recordLabel(dnsCheck.www.status)}
                {dnsCheck.www.status !== 'match' && (
                  <span className="text-gray-500"> · expected {dnsCheck.www.expected}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verification records (when DNS not yet resolving) */}
      {verification && verification.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1.5">
          <div className="font-semibold">Vercel verification needed</div>
          <ul className="space-y-1">
            {verification.map((v, i) => (
              <li key={i} className="font-mono">
                {v.type} <span className="text-amber-900/60">{v.domain}</span> = {v.value}
              </li>
            ))}
          </ul>
          <div className="text-amber-900/70">
            DNS hasn&apos;t propagated yet. Wait a few minutes, then click &quot;Add to Vercel&quot; again.
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            message.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty || !isValid}
          className="bg-ink-900 text-cream-50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={polling ? () => pollAbortRef.current?.abort() : handleCheckDns}
          disabled={!initialDomain || isDirty}
          className="bg-white border border-ink-900/15 rounded-lg px-4 py-2 text-sm hover:border-ink-900/30 disabled:opacity-40 disabled:cursor-not-allowed"
          title={
            isDirty
              ? 'Save first'
              : !initialDomain
              ? 'Set a domain first'
              : 'Resolve DNS and compare against this Vercel project'
          }
        >
          {polling ? 'Stop checking' : 'Check DNS'}
        </button>
        <button
          type="button"
          onClick={handleAddToVercel}
          disabled={provisioning || !initialDomain || isDirty}
          className="bg-white border border-ink-900/15 rounded-lg px-4 py-2 text-sm hover:border-ink-900/30 disabled:opacity-40 disabled:cursor-not-allowed"
          title={
            isDirty
              ? 'Save first'
              : !initialDomain
              ? 'Set a domain first'
              : 'Add to Vercel and verify (~15s)'
          }
        >
          {provisioning ? 'Provisioning…' : status === 'live' ? 'Re-verify' : 'Add to Vercel'}
        </button>
        {initialDomain && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="ml-auto text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            {removing ? 'Removing…' : 'Remove domain'}
          </button>
        )}
      </div>
    </div>
  );
}
