// Google Search Console auth — service account, not OAuth.
//
// One agency Google account owns every client property; a GCP service account
// is added as a Full user on each of them. That means a single server-side
// credential reads all clients, with no consent screen and no refresh token to
// expire. We mint a short-lived access token by self-signing a JWT assertion
// (RFC 7523) and exchanging it at Google's token endpoint.
//
// Hand-rolled rather than pulling in googleapis/google-auth-library: the whole
// exchange is ~40 lines against node:crypto and those packages are large.

import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const JWT_BEARER = 'urn:ietf:params:oauth:grant-type:jwt-bearer';

/** Thrown when GSC_SERVICE_ACCOUNT_JSON is absent or unparseable. Callers
 *  treat this as "feature not set up yet" rather than a hard failure. */
export class GscNotConfiguredError extends Error {
  constructor(detail: string) {
    super(`Search Console is not configured: ${detail}`);
    this.name = 'GscNotConfiguredError';
  }
}

type ServiceAccountKey = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

let cachedKey: ServiceAccountKey | null = null;

/**
 * Reads the service account key from GSC_SERVICE_ACCOUNT_JSON. Accepts the
 * downloaded key file either as raw JSON or base64-encoded — base64 is the
 * safer paste into Vercel's env UI because the PEM's newlines survive intact.
 */
function loadKey(): ServiceAccountKey {
  if (cachedKey) return cachedKey;

  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new GscNotConfiguredError('GSC_SERVICE_ACCOUNT_JSON is not set');

  let parsed: unknown;
  try {
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    parsed = JSON.parse(json);
  } catch {
    throw new GscNotConfiguredError('GSC_SERVICE_ACCOUNT_JSON is not valid JSON or base64-encoded JSON');
  }

  const key = parsed as Partial<ServiceAccountKey>;
  if (!key.client_email || !key.private_key) {
    throw new GscNotConfiguredError('service account key is missing client_email or private_key');
  }

  cachedKey = {
    client_email: key.client_email,
    // Env vars set via shell/CI often carry literal \n instead of real newlines;
    // the PEM parser rejects those.
    private_key: key.private_key.replace(/\\n/g, '\n'),
    token_uri: key.token_uri,
  };
  return cachedKey;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Access tokens last an hour. Cached in module scope so a report run over N
// clients performs one token exchange, not N.
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // 60s skew buffer so a token doesn't expire mid-request.
  if (cachedToken && cachedToken.expiresAt - 60 > now) return cachedToken.value;

  const key = loadKey();
  const audience = key.token_uri ?? TOKEN_URL;

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPE,
      aud: audience,
      iat: now,
      exp: now + 3600,
    }),
  );

  const signingInput = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  const assertion = `${signingInput}.${base64url(signer.sign(key.private_key))}`;

  const res = await fetch(audience, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: JWT_BEARER, assertion }),
  });

  const body = (await res.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; error?: string; error_description?: string }
    | null;

  if (!res.ok || !body?.access_token) {
    const detail = body?.error_description ?? body?.error ?? `HTTP ${res.status}`;
    throw new Error(`Search Console token exchange failed: ${detail}`);
  }

  cachedToken = {
    value: body.access_token,
    expiresAt: now + (body.expires_in ?? 3600),
  };
  return cachedToken.value;
}

/** The service account address that must be added as a user on each property. */
export function serviceAccountEmail(): string | null {
  try {
    return loadKey().client_email;
  } catch {
    return null;
  }
}
