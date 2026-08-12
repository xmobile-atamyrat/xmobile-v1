import crypto from 'crypto';
import * as admin from 'firebase-admin';
import https from 'https';
import { URL } from 'url';
// Reuses the DNS cache + learned-working-IP pool built for the Slack webhook.
// It is host-agnostic (the hooks.slack.com seed list simply yields [] for other
// hosts); only its name is Slack-specific. Worth hoisting to src/lib/net/ if a
// third caller appears.
import { slackIpCache } from '../slack/ipCache';

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

/** Matches SlackClient — a mint that hasn't answered in 10s isn't going to. */
const REQUEST_TIMEOUT_MS = 10_000;
const MINT_ATTEMPTS = 3;
const MINT_RETRY_BASE_MS = 300;
/**
 * After a failed mint, reject fast for this long instead of re-dialing. The
 * retry job fans out up to 100 rows per tick (scripts/batch-runner/jobs/
 * notification-retry.ts) and every one of them would otherwise trigger its own
 * mint + retries against a network that just proved it is down. Well under the
 * job's 60s tick, so it never delays a real retry.
 */
const FAILURE_COOLDOWN_MS = 30_000;

interface ServiceAccountJson {
  client_email: string;
  private_key: string;
}

export interface TokenHttpResponse {
  status: number;
  body: string;
}

/** Seam for tests; production uses the IP-rotating https transport below. */
export type TokenTransport = (
  url: URL,
  form: string,
) => Promise<TokenHttpResponse>;

export interface CredentialOptions {
  transport?: TokenTransport;
  retryDelayMs?: number;
  failureCooldownMs?: number;
}

/** Non-retryable: the server answered and the answer won't change on a retry. */
class DeterministicTokenError extends Error {}

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
 * Flattens an error and its `cause` chain into one line. Node's `fetch` reports
 * every transport problem as the opaque string "fetch failed" and hides the
 * real reason (ENOTFOUND / ECONNREFUSED / ECONNRESET / TLS) in `cause` — which
 * is exactly what made the Slack alerts undiagnosable.
 */
export function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: any = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const code = current.code ? ` (${current.code})` : '';
    const message =
      typeof current === 'string'
        ? current
        : current.message || String(current);
    parts.push(`${message}${code}`);
    current = current.cause;
  }
  return parts.join(' <- ');
}

/** One HTTPS POST. When `ip` is set the socket goes to that IP but SNI/Host
 *  still carry the real hostname, which is what gets past the SNI filter. */
function postOnce(
  url: URL,
  form: string,
  ip?: string,
): Promise<TokenHttpResponse> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: ip || url.hostname,
        ...(ip ? { servername: url.hostname } : {}),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(form),
          Host: url.hostname,
          Connection: 'close',
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode || 0, body }));
      },
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`timeout after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.write(form);
    req.end();
  });
}

/**
 * Production transport: try known-good IPs first, then the rest, then plain
 * hostname resolution. Mirrors SlackClient's strategy, which exists because
 * individual Google/Slack edge IPs are intermittently blackholed on this VM.
 */
export const ipRotatingTransport: TokenTransport = async (url, form) => {
  let ips: string[] = [];
  try {
    ips = await slackIpCache.getIpsToTry(url.hostname);
  } catch {
    // DNS itself failed — fall straight through to the OS resolver.
    return postOnce(url, form);
  }

  const failures: string[] = [];
  for (let i = 0; i < ips.length; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const response = await postOnce(url, form, ips[i]);
      // Any HTTP answer proves this IP is reachable, even a 4xx — that is a
      // credential problem, not a routing one.
      slackIpCache.markIpAsWorking(url.hostname, ips[i]);
      return response;
    } catch (error) {
      failures.push(`${ips[i]}: ${describeError(error)}`);
    }
  }

  try {
    return await postOnce(url, form);
  } catch (error) {
    failures.push(`${url.hostname}: ${describeError(error)}`);
  }
  throw new Error(`all routes failed [${failures.join('; ')}]`);
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface MintedToken {
  access_token: string;
  expires_in: number;
}

async function mintWithRetry(
  serviceAccount: ServiceAccountJson,
  transport: TokenTransport,
  retryDelayMs: number,
): Promise<MintedToken> {
  const url = new URL(GOOGLE_TOKEN_URL);
  let lastError: unknown;

  for (let attempt = 1; attempt <= MINT_ATTEMPTS; attempt += 1) {
    try {
      const form = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        // Re-signed per attempt so a slow retry can't ship a stale iat/exp.
        assertion: createSignedJwt(serviceAccount),
      }).toString();

      // eslint-disable-next-line no-await-in-loop
      const response = await transport(url, form);

      if (response.status >= 200 && response.status < 300) {
        const data = JSON.parse(response.body) as MintedToken;
        if (!data.access_token || typeof data.expires_in !== 'number') {
          throw new DeterministicTokenError(
            `malformed token response: ${response.body.slice(0, 200)}`,
          );
        }
        return data;
      }

      const detail = `${response.status} ${response.body.slice(0, 200)}`;
      // 5xx and 429 are worth another dial; the rest won't change.
      if (response.status >= 500 || response.status === 429) {
        throw new Error(`token endpoint returned ${detail}`);
      }
      throw new DeterministicTokenError(`token endpoint returned ${detail}`);
    } catch (error) {
      lastError = error;
      if (error instanceof DeterministicTokenError) break;
      if (attempt < MINT_ATTEMPTS) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(retryDelayMs * 2 ** (attempt - 1));
      }
    }
  }

  throw new Error(
    `[FCM Service] OAuth token mint at ${GOOGLE_TOKEN_URL} failed: ${describeError(lastError)}`,
  );
}

/**
 * Builds a firebase-admin Credential that fetches its OAuth2 access token from
 * `oauth2.googleapis.com` (reachable from the TM VM) instead of the blocked
 * `www.googleapis.com` used by the default `admin.credential.cert()`.
 *
 * The signed-JWT bearer flow is implemented with Node's built-in `crypto` and
 * `https` so we add no new dependency (per AGENTS.md: prefer VM-local,
 * self-contained code).
 */
export function createOAuth2GoogleapisCredential(
  serviceAccount: ServiceAccountJson,
  options: CredentialOptions = {},
): admin.credential.Credential {
  const transport = options.transport ?? ipRotatingTransport;
  const retryDelayMs = options.retryDelayMs ?? MINT_RETRY_BASE_MS;
  const failureCooldownMs = options.failureCooldownMs ?? FAILURE_COOLDOWN_MS;

  // Token cache: firebase-admin caches tokens internally, but we also guard
  // here so a blocked/slow path can never trigger more than one mint per hour.
  let cached: (MintedToken & { mintedAtMs: number }) | null = null;
  // Collapses the per-token fan-out of sendEachForMulticast into one mint.
  let inFlight: Promise<MintedToken> | null = null;
  let cooldownUntilMs = 0;
  let lastFailure: Error | null = null;

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

      if (lastFailure && Date.now() < cooldownUntilMs) {
        throw lastFailure;
      }

      if (!inFlight) {
        inFlight = mintWithRetry(serviceAccount, transport, retryDelayMs)
          .then((data) => {
            cached = { ...data, mintedAtMs: Date.now() };
            lastFailure = null;
            cooldownUntilMs = 0;
            return data;
          })
          .catch((error) => {
            lastFailure =
              error instanceof Error ? error : new Error(String(error));
            cooldownUntilMs = Date.now() + failureCooldownMs;
            throw lastFailure;
          })
          .finally(() => {
            inFlight = null;
          });
      }

      const data = await inFlight;
      return { access_token: data.access_token, expires_in: data.expires_in };
    },
  };
}
