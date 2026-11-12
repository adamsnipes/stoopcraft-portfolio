const VERCEL_API = 'https://api.vercel.com';

type VercelDomainResponse = {
  name: string;
  verified: boolean;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
};

type VercelCreds = { token: string; projectId: string; qs: string };

function vercelCreds(): VercelCreds {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    throw new Error('VERCEL_API_TOKEN or VERCEL_PROJECT_ID not configured');
  }

  return { token, projectId, qs: teamId ? `?teamId=${teamId}` : '' };
}

/**
 * Add a single hostname to the Vercel project and poll until its cert
 * provisions. Retries up to 3 times with 5-second pauses.
 *
 * `redirectTo`, when set, attaches the host as a 308 redirect to that target
 * (used for www → apex). Vercel still provisions a cert for the redirecting
 * host, which is exactly what stops the browser TLS warning on www.
 */
async function addSingleHost(
  creds: VercelCreds,
  host: string,
  redirectTo?: string
): Promise<{ verified: boolean; verification?: VercelDomainResponse['verification'] }> {
  const { token, projectId, qs } = creds;
  const url = `${VERCEL_API}/v9/projects/${projectId}/domains${qs}`;

  const body: Record<string, unknown> = { name: host };
  if (redirectTo) {
    body.redirect = redirectTo;
    body.redirectStatusCode = 308;
  }

  // POST to add domain. 409 = already attached to this project; treat as
  // success and fall through to the verify loop so the operator can re-check
  // status by hitting the same endpoint.
  const addRes = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let added: VercelDomainResponse | null = null;
  if (addRes.ok) {
    added = (await addRes.json()) as VercelDomainResponse;
    if (added.verified) return { verified: true };
  } else if (addRes.status === 409) {
    // Already attached. If it needs a redirect (www) that may not have been
    // set on a prior partial run, PATCH it so the redirect is idempotent.
    if (redirectTo) {
      await fetch(
        `${VERCEL_API}/v9/projects/${projectId}/domains/${encodeURIComponent(host)}${qs}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ redirect: redirectTo, redirectStatusCode: 308 }),
        }
      ).catch(() => {
        /* non-fatal: verify loop below still reports real status */
      });
    }
  } else {
    const text = await addRes.text();
    throw new Error(`Vercel add domain failed for ${host}: ${addRes.status} ${text}`);
  }

  // Not yet verified — retry loop (cert provisioning can take a few seconds)
  for (let attempt = 0; attempt < 3; attempt++) {
    await new Promise((r) => setTimeout(r, 5000));

    const verifyUrl = `${VERCEL_API}/v9/projects/${projectId}/domains/${encodeURIComponent(host)}/verify${qs}`;
    const verifyRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (verifyRes.ok) {
      const result = (await verifyRes.json()) as VercelDomainResponse;
      if (result.verified) return { verified: true };
    }
  }

  return { verified: false, verification: added?.verification };
}

/**
 * Attach a custom domain to the Vercel project — BOTH the apex and its `www`
 * host, so both get TLS certs. www is added as a 308 redirect to the apex
 * (the apex is canonical: it's what we store in custom_domain and what the
 * proxy routes on). Without the www host, Vercel never issues a cert for
 * www.<domain> and the browser shows a certificate warning there.
 *
 * `verified` is true only when BOTH hosts have provisioned. `verification`
 * aggregates any still-pending DNS records from either host so the admin
 * alert / UI can show the operator exactly what's outstanding.
 */
export async function addDomainToVercel(
  domain: string
): Promise<{ verified: boolean; verification?: VercelDomainResponse['verification'] }> {
  const creds = vercelCreds();

  // custom_domain is always stored apex-only (the admin UI enforces this),
  // but guard against a stray leading www so we don't build www.www.<domain>.
  const apex = domain.replace(/^www\./i, '');
  const wwwHost = `www.${apex}`;

  const apexResult = await addSingleHost(creds, apex);
  const wwwResult = await addSingleHost(creds, wwwHost, apex);

  const verification = [
    ...(apexResult.verification ?? []),
    ...(wwwResult.verification ?? []),
  ];

  return {
    verified: apexResult.verified && wwwResult.verified,
    verification: verification.length > 0 ? verification : undefined,
  };
}

/**
 * Remove a custom domain from the Vercel project — both apex and www.
 * Called during hard delete or when a cancelled customer's domain is released.
 */
export async function removeDomainFromVercel(domain: string): Promise<void> {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) return; // non-fatal in cron context

  const qs = teamId ? `?teamId=${teamId}` : '';
  const apex = domain.replace(/^www\./i, '');

  await Promise.all(
    [apex, `www.${apex}`].map((host) =>
      fetch(
        `${VERCEL_API}/v9/projects/${projectId}/domains/${encodeURIComponent(host)}${qs}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      ).catch(() => {
        /* best-effort: one host may not exist; don't block the other */
      })
    )
  );
}
