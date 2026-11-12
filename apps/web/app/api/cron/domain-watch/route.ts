import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sendAdminAlert } from '@/lib/email';

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

type WhoisResponse = {
  WhoisRecord?: {
    registryData?: {
      expiresDate?: string;
      expiresDateNormalized?: string;
    };
    expiresDate?: string;
    expiresDateNormalized?: string;
  };
};

/**
 * Look up domain expiry via the WHOIS XML API (whoisxmlapi.com).
 * Requires WHOIS_API_KEY in env. Returns null if lookup fails.
 */
async function getDomainExpiryDate(domain: string): Promise<Date | null> {
  const apiKey = process.env.WHOIS_API_KEY;
  if (!apiKey) {
    // No WHOIS API configured — skip expiry check, alert admin
    return null;
  }

  try {
    const res = await fetch(
      `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${apiKey}&domainName=${encodeURIComponent(domain)}&outputFormat=JSON`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;

    const data = await res.json() as WhoisResponse;
    const expiresStr =
      data.WhoisRecord?.registryData?.expiresDateNormalized ??
      data.WhoisRecord?.registryData?.expiresDate ??
      data.WhoisRecord?.expiresDateNormalized ??
      data.WhoisRecord?.expiresDate;

    return expiresStr ? new Date(expiresStr) : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createServiceRoleClient();

  // Fetch all clients with platform-owned domains
  const { data: clients, error } = await admin
    .from('clients')
    .select('id, business_name, custom_domain, status, cancelled_at, expires_at')
    .eq('domain_owner', 'platform')
    .not('custom_domain', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const alerts: string[] = [];

  for (const client of clients ?? []) {
    if (!client.custom_domain) continue;

    const expiryDate = await getDomainExpiryDate(client.custom_domain);

    if (!expiryDate) {
      // WHOIS lookup failed — alert admin so they can check manually
      alerts.push(
        `⚠️ WHOIS lookup failed for <strong>${client.custom_domain}</strong> ` +
        `(${client.business_name}, ID: ${client.id}). Check manually in Namecheap.`
      );
      continue;
    }

    const daysUntilExpiry = Math.floor((expiryDate.getTime() - now) / (24 * 60 * 60 * 1000));

    if (daysUntilExpiry > 30) continue; // Not within alert window

    const isActive = client.status === 'claimed' && !client.cancelled_at;
    const isCancelledAndExpired =
      client.cancelled_at &&
      client.expires_at &&
      new Date(client.expires_at) < new Date();

    if (isCancelledAndExpired) {
      // Customer cancelled and service period ended — let domain expire, disable auto-renew
      alerts.push(
        `🔴 DISABLE auto-renew for <strong>${client.custom_domain}</strong> ` +
        `(${client.business_name}). Customer cancelled. ` +
        `Domain expires in ${daysUntilExpiry} days. ` +
        `<a href="https://ap.www.namecheap.com/Domains/DomainControlPanel/${client.custom_domain}">Namecheap</a>`
      );
    } else if (isActive) {
      // Active customer — ensure auto-renew is on
      alerts.push(
        `🟡 VERIFY auto-renew is ON for <strong>${client.custom_domain}</strong> ` +
        `(${client.business_name}). Active customer. ` +
        `Domain expires in ${daysUntilExpiry} days. ` +
        `<a href="https://ap.www.namecheap.com/Domains/DomainControlPanel/${client.custom_domain}">Namecheap</a>`
      );
    } else {
      // In cancellation grace period
      alerts.push(
        `🟠 Domain ${client.custom_domain} (${client.business_name}) expires in ` +
        `${daysUntilExpiry} days. Customer in grace period. Check if they want to transfer.`
      );
    }

    // Log the check
    await admin.from('events').insert({
      client_id: client.id,
      type: 'domain_watch_check',
      metadata: {
        domain: client.custom_domain,
        days_until_expiry: daysUntilExpiry,
        expiry_date: expiryDate.toISOString(),
      },
    });
  }

  if (alerts.length > 0) {
    await sendAdminAlert({
      subject: `⚠️ Domain renewal watchdog — ${alerts.length} action(s) needed`,
      html: `<p>Domain renewal check complete. Actions needed:</p><ul>${alerts.map((a) => `<li>${a}</li>`).join('')}</ul>`,
    });
  }

  return NextResponse.json({ success: true, alerts_sent: alerts.length });
}
