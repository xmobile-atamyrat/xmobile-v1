import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ApiEndpoints BASE_URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses production host in production', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production');
    const { default: base } = await import('@/lib/ApiEndpoints');
    expect(base).toBe('https://xmobile.com.tm');
  });

  it('builds dev URL from NEXT_PUBLIC_HOST and PORT', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_HOST', '192.168.1.5');
    vi.stubEnv('NEXT_PUBLIC_PORT', '3003');
    const { default: base } = await import('@/lib/ApiEndpoints');
    expect(base).toBe('http://192.168.1.5:3003');
  });

  it('uses the staging host in staging', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging');
    const { default: base } = await import('@/lib/ApiEndpoints');
    expect(base).toBe('http://dev.xmobile.com.tm');
  });
});

describe('ApiEndpoints WS_BASE_URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses the secure socket in production', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production');
    const { WS_BASE_URL } = await import('@/lib/ApiEndpoints');
    expect(WS_BASE_URL).toBe('wss://xmobile.com.tm');
  });

  // Staging serves no TLS, so `wss://` would hang on a handshake that never
  // completes -- and the old NODE_ENV check sent it to production's socket.
  it('uses the plain staging socket in staging', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging');
    const { WS_BASE_URL } = await import('@/lib/ApiEndpoints');
    expect(WS_BASE_URL).toBe('ws://dev.xmobile.com.tm');
  });

  it('does not fall back to the production socket in staging builds', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging');
    vi.stubEnv('NODE_ENV', 'production');
    const { WS_BASE_URL } = await import('@/lib/ApiEndpoints');
    expect(WS_BASE_URL).not.toContain('wss://');
    expect(WS_BASE_URL).not.toContain('//xmobile.com.tm');
  });

  it('reads the configured socket URL in development', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_WS_URL', 'ws://192.168.1.5:3002');
    const { WS_BASE_URL } = await import('@/lib/ApiEndpoints');
    expect(WS_BASE_URL).toBe('ws://192.168.1.5:3002');
  });
});
