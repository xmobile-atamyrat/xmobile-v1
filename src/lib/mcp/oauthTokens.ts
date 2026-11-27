import crypto from 'node:crypto';

/**
 * Opaque random secrets with a recognisable prefix, so one pasted into a chat
 * or committed by mistake is easy to spot and grep for. Only their SHA-256
 * is stored: a database dump hands out no usable token.
 */
export function newSecret(prefix: string): string {
  return `${prefix}${crypto.randomBytes(32).toString('base64url')}`;
}

export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** PKCE (RFC 7636), S256 only: the plain method gives no protection. */
export function pkceS256(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier, 'ascii')
    .digest('base64url');
}

const VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;
const CHALLENGE_PATTERN = /^[A-Za-z0-9\-_]{43}$/;

export function isValidCodeVerifier(verifier: unknown): verifier is string {
  return typeof verifier === 'string' && VERIFIER_PATTERN.test(verifier);
}

export function isValidCodeChallenge(challenge: unknown): challenge is string {
  return typeof challenge === 'string' && CHALLENGE_PATTERN.test(challenge);
}

export const ACCESS_TOKEN_PREFIX = 'xmcp_at_';
export const REFRESH_TOKEN_PREFIX = 'xmcp_rt_';
export const AUTH_CODE_PREFIX = 'xmcp_ac_';
export const CLIENT_SECRET_PREFIX = 'xmcp_cs_';
export const CLIENT_ID_PREFIX = 'xmcp_client_';

export function newClientId(): string {
  return `${CLIENT_ID_PREFIX}${crypto.randomBytes(16).toString('base64url')}`;
}

/**
 * A grant's token pair is not random: it is an HMAC of the grant's id and its
 * generation (the pair's access expiry, in ms), under a key derived from
 * `ACCESS_TOKEN_SECRET`. So the server can hand out the very pair it already
 * issued, without storing it: a retried request, or two that race, get the
 * same answer instead of one overwriting what the other just sent. Only the
 * hashes are stored, and without the key a database dump gives no token.
 *
 * The refresh token also names its grant and generation,
 * `xmcp_rt_<grantId>.<generation>.<mac>`. One whose MAC checks out but which
 * is neither the grant's current nor previous token is a real, older token
 * coming back, which means it leaked, so its grant can be ended. A made-up
 * token naming a grant fails the MAC and ends nothing.
 */
/**
 * A 32-byte key derived from the app's access-token secret, so there's no new
 * variable to set. Each use passes its own `purpose`, so a key made for one
 * (say, sealing codes) is useless for another (making tokens).
 */
export function mcpKey(purpose: string): Buffer {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) throw new Error('ACCESS_TOKEN_SECRET is not set');
  return Buffer.from(crypto.hkdfSync('sha256', secret, '', purpose, 32));
}

function tokenMac(kind: 'at' | 'rt', grantId: string, generation: number) {
  return crypto
    .createHmac('sha256', mcpKey('xmobile mcp token pair'))
    .update(`${kind}.${grantId}.${generation}`)
    .digest('base64url');
}

export type TokenPair = { accessToken: string; refreshToken: string };

export function tokenPairFor(grantId: string, generation: number): TokenPair {
  return {
    accessToken: `${ACCESS_TOKEN_PREFIX}${tokenMac('at', grantId, generation)}`,
    refreshToken: `${REFRESH_TOKEN_PREFIX}${grantId}.${generation}.${tokenMac('rt', grantId, generation)}`,
  };
}

/**
 * The grant and generation a refresh token was made for, or null if this
 * server didn't make it. The generation must be written the way
 * `tokenPairFor` writes it (no leading zero): `0123` and `123` are one number,
 * so both would pass the MAC, but only one is the token that was issued, and
 * the other would look like an old token coming back and end its grant.
 */
export function parseRefreshToken(
  token: string,
): { grantId: string; generation: number } | null {
  if (!token.startsWith(REFRESH_TOKEN_PREFIX) || token.length > 300) {
    return null;
  }
  const parts = token.slice(REFRESH_TOKEN_PREFIX.length).split('.');
  if (parts.length !== 3) return null;
  const [grantId, written, mac] = parts;
  if (!grantId || !/^(0|[1-9]\d{0,15})$/.test(written)) return null;
  const generation = Number(written);
  return safeEqual(mac, tokenMac('rt', grantId, generation))
    ? { grantId, generation }
    : null;
}
