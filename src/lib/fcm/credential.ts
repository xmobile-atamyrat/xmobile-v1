import crypto from 'crypto';
import * as admin from 'firebase-admin';

/**
 * Google's OAuth2 token endpoint.
 *
 * IMPORTANT (Turkmenistan deployment): the firebase-admin SDK's default
 * credential (`admin.credential.cert()`) mints its access token at
 * `https://www.googleapis.com/oauth2/v4/token` — a host hardcoded inside the
 * transitive `gtoken` dependency. On the Telekom VM that hostname is blocked at
 * TWO layers:
 *   1. DNS is sinkholed (`www.googleapis.com` → 127.0.0.1), and
 *   2. the upstream firewall drops TLS ClientHellos whose SNI is
 *      `www.googleapis.com` (verified: the SAME Google IP completes the
 *      handshake for SNI `oauth2.googleapis.com` but times out for
 *      `www.googleapis.com`).
 *
 * `oauth2.googleapis.com` is Google's canonical modern token endpoint, passes
 * the SNI filter from the VM, and is an accepted token endpoint / JWT audience
 * for service-account assertions. So we mint the access token ourselves against
 * it instead of relying on gtoken's hardcoded (blocked) host. See AGENTS.md for
 * the network context.
 */
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Scopes firebase-admin normally requests for its server SDKs. These are plain
 * OAuth scope *identifiers* embedded in the signed JWT — they are NOT network
 * calls, so the `www.googleapis.com` strings here never hit the SNI filter.
 */
const SCOPES = 'https://www.googleapis.com/auth/firebase.messaging';

interface ServiceAccountJson {
  client_email: string;
  private_key: string;
}

function base64url(input: Buffer | string): string {
  return (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64')
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createSignedJwt(serviceAccount: ServiceAccountJson): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: serviceAccount.client_email,
    scope: SCOPES,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(claims),
  )}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signingInput)
    .sign(serviceAccount.private_key);

  return `${signingInput}.${base64url(signature)}`;
}

/**
 * Builds a firebase-admin Credential that fetches its OAuth2 access token from
 * `oauth2.googleapis.com` (reachable from the TM VM) instead of the blocked
 * `www.googleapis.com` used by the default `admin.credential.cert()`.
 *
 * The signed-JWT bearer flow is implemented with Node's built-in `crypto` so we
 * add no new dependency (per AGENTS.md: prefer VM-local, self-contained code).
 */
export function createOAuth2GoogleapisCredential(
  serviceAccount: ServiceAccountJson,
): admin.credential.Credential {
  // Token cache: firebase-admin caches tokens internally, but we also guard
  // here so a blocked/slow path can never trigger more than one mint per hour.
  let cached: {
    access_token: string;
    expires_in: number;
    mintedAtMs: number;
  } | null = null;

  return {
    async getAccessToken() {
      // Reuse until 60s before expiry.
      if (
        cached &&
        Date.now() < cached.mintedAtMs + (cached.expires_in - 60) * 1000
      ) {
        return {
          access_token: cached.access_token,
          expires_in: cached.expires_in,
        };
      }

      const assertion = createSignedJwt(serviceAccount);
      const body = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      });

      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `[FCM Service] OAuth token request to ${GOOGLE_TOKEN_URL} failed: ${response.status} ${detail}`,
        );
      }

      const data = (await response.json()) as {
        access_token: string;
        expires_in: number;
      };

      cached = {
        access_token: data.access_token,
        expires_in: data.expires_in,
        mintedAtMs: Date.now(),
      };

      return {
        access_token: data.access_token,
        expires_in: data.expires_in,
      };
    },
  };
}
