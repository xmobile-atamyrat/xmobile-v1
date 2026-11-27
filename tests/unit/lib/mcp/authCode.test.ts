import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AuthCodePayload,
  openAuthCode,
  sealAuthCode,
} from '@/lib/mcp/authCode';

const payload: AuthCodePayload = {
  clientId: 'xmcp_client_abc',
  userId: 'user-123',
  redirectUri: 'https://chatgpt.com/connector_platform_oauth_redirect',
  codeChallenge: 'x'.repeat(43),
  scope: 'catalog.images',
  expiresAt: 1_800_000_000_000,
};

describe('MCP authorization codes', () => {
  beforeEach(() => {
    vi.stubEnv('ACCESS_TOKEN_SECRET', 'test-secret-one');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('opens what it sealed, and hides it from whoever holds the code', () => {
    const code = sealAuthCode(payload);
    expect(code.startsWith('xmcp_ac_')).toBe(true);
    expect(code).not.toContain('user-123');
    expect(
      Buffer.from(code.slice('xmcp_ac_'.length), 'base64url').toString(),
    ).not.toContain('user-123');
    expect(openAuthCode(code)).toEqual(payload);
  });

  it('gives a different code each time', () => {
    expect(sealAuthCode(payload)).not.toBe(sealAuthCode(payload));
  });

  it('refuses a code that was changed, cut short or sealed under another key', () => {
    const code = sealAuthCode(payload);
    const mid = Math.floor(code.length / 2);
    const flipped = code[mid] === 'A' ? 'B' : 'A';
    expect(
      openAuthCode(`${code.slice(0, mid)}${flipped}${code.slice(mid + 1)}`),
    ).toBeNull();
    expect(openAuthCode(code.slice(0, 30))).toBeNull();
    expect(openAuthCode('xmcp_ac_')).toBeNull();
    expect(openAuthCode('not-a-code')).toBeNull();

    vi.stubEnv('ACCESS_TOKEN_SECRET', 'test-secret-two');
    expect(openAuthCode(code)).toBeNull();
  });

  it('opens only the exact string it issued', () => {
    // Each of these decodes to the same bytes, but would hash differently
    // when traded, slipping past the single-use check.
    const code = sealAuthCode(payload);
    expect(openAuthCode(`${code}=`)).toBeNull();
    expect(openAuthCode(`${code}==`)).toBeNull();
    expect(openAuthCode(`${code}!`)).toBeNull();
    expect(openAuthCode(`${code.slice(0, 20)}.${code.slice(20)}`)).toBeNull();
    expect(openAuthCode(code)).toEqual(payload);
  });
});
