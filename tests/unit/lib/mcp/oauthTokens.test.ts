import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseRefreshToken, tokenPairFor } from '@/lib/mcp/oauthTokens';

const GRANT = '6f1c2a9e-4b7d-4e2a-9c1f-0a1b2c3d4e5f';
const GENERATION = 1_800_000_000_000;

describe('MCP token pairs', () => {
  beforeEach(() => {
    vi.stubEnv('ACCESS_TOKEN_SECRET', 'test-secret-one');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('gives the same pair for the same grant and generation, and only then', () => {
    const pair = tokenPairFor(GRANT, GENERATION);
    expect(tokenPairFor(GRANT, GENERATION)).toEqual(pair);
    expect(tokenPairFor(GRANT, GENERATION + 1).refreshToken).not.toBe(
      pair.refreshToken,
    );
    expect(tokenPairFor(GRANT, GENERATION + 1).accessToken).not.toBe(
      pair.accessToken,
    );
    expect(pair.accessToken.startsWith('xmcp_at_')).toBe(true);
    expect(pair.accessToken).not.toContain(GRANT);
  });

  it('names the grant in the refresh token', () => {
    const { refreshToken } = tokenPairFor(GRANT, GENERATION);
    expect(refreshToken.startsWith(`xmcp_rt_${GRANT}.${GENERATION}.`)).toBe(
      true,
    );
    expect(parseRefreshToken(refreshToken)).toEqual({
      grantId: GRANT,
      generation: GENERATION,
    });
  });

  it('refuses a token whose MAC does not match its grant and generation', () => {
    const { refreshToken } = tokenPairFor(GRANT, GENERATION);
    const mac = refreshToken.split('.').pop();
    expect(
      parseRefreshToken(`xmcp_rt_${GRANT}.${GENERATION}.${'b'.repeat(43)}`),
    ).toBeNull();
    expect(
      parseRefreshToken(`xmcp_rt_${GRANT}.${GENERATION + 1}.${mac}`),
    ).toBeNull();
    const otherGrant = GRANT.replace('6f', '7f');
    expect(
      parseRefreshToken(`xmcp_rt_${otherGrant}.${GENERATION}.${mac}`),
    ).toBeNull();
  });

  it('refuses a generation not written the way it was issued', () => {
    // `0<generation>` is the same number, so it passes the MAC, but it is not
    // the token that was issued and would look like a leaked old one.
    const { refreshToken } = tokenPairFor(GRANT, GENERATION);
    const mac = refreshToken.split('.').pop();
    expect(
      parseRefreshToken(`xmcp_rt_${GRANT}.0${GENERATION}.${mac}`),
    ).toBeNull();
    expect(
      parseRefreshToken(`xmcp_rt_${GRANT}.00${GENERATION}.${mac}`),
    ).toBeNull();
    const zero = tokenPairFor(GRANT, 0).refreshToken;
    expect(parseRefreshToken(zero)).toEqual({ grantId: GRANT, generation: 0 });
  });

  it('refuses anything that is not shaped like one', () => {
    expect(parseRefreshToken('xmcp_at_whatever')).toBeNull();
    expect(parseRefreshToken(`xmcp_rt_${GRANT}`)).toBeNull();
    expect(parseRefreshToken(`xmcp_rt_${GRANT}.a.b.c`)).toBeNull();
    expect(parseRefreshToken(`xmcp_rt_${GRANT}.12x.abc`)).toBeNull();
    expect(parseRefreshToken('xmcp_rt_..')).toBeNull();
    expect(parseRefreshToken(`xmcp_rt_${'a'.repeat(400)}`)).toBeNull();
  });

  it('stops trusting its tokens when the secret changes', () => {
    const pair = tokenPairFor(GRANT, GENERATION);
    vi.stubEnv('ACCESS_TOKEN_SECRET', 'test-secret-two');
    expect(parseRefreshToken(pair.refreshToken)).toBeNull();
    expect(tokenPairFor(GRANT, GENERATION)).not.toEqual(pair);
  });
});
