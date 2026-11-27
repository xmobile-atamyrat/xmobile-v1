import crypto from 'node:crypto';

import { z } from 'zod';

import { AUTH_CODE_PREFIX, mcpKey } from './oauthTokens';

/**
 * Authorization codes carry their own data instead of a database row: the
 * approval is sealed with AES-256-GCM, so the client can neither read it (the
 * code sits in a redirect URL, and holds the user's id) nor change it without
 * the tag failing. Single use is enforced when the code is traded:
 * `McpGrant.authCodeHash` is unique, so a code can create at most one grant.
 */
export type AuthCodePayload = {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  /** Milliseconds since the epoch. */
  expiresAt: number;
};

const payloadSchema = z.object({
  clientId: z.string(),
  userId: z.string(),
  redirectUri: z.string(),
  codeChallenge: z.string(),
  scope: z.string(),
  expiresAt: z.number(),
});

const IV_BYTES = 12;
const TAG_BYTES = 16;

const codeKey = () => mcpKey('xmobile mcp authorization code');

export function sealAuthCode(payload: AuthCodePayload): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', codeKey(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return `${AUTH_CODE_PREFIX}${Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url')}`;
}

/** The payload, or null for anything this server didn't seal (or that was altered). */
export function openAuthCode(code: string): AuthCodePayload | null {
  if (!code.startsWith(AUTH_CODE_PREFIX) || code.length > 4000) return null;
  const body = code.slice(AUTH_CODE_PREFIX.length);
  const raw = Buffer.from(body, 'base64url');
  // Node's decoder skips padding and stray characters, so `X`, `X=` and `X!`
  // all open to the same approval. The trade hashes the code as written to
  // keep it single-use, so only the exact string that was issued may open.
  if (raw.toString('base64url') !== body) return null;
  if (raw.length <= IV_BYTES + TAG_BYTES) return null;
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      codeKey(),
      raw.subarray(0, IV_BYTES),
    );
    decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
    const json = Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES, raw.length - TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
    const parsed = payloadSchema.safeParse(JSON.parse(json));
    // zod marks every field optional without strictNullChecks; the schema
    // requires them all.
    return parsed.success ? (parsed.data as AuthCodePayload) : null;
  } catch {
    return null;
  }
}
