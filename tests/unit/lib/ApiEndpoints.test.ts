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

  it('uses the https staging host in staging', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging');
    const { default: base } = await import('@/lib/ApiEndpoints');
    expect(base).toBe('https://dev.xmobile.com.tm');
  });

  it('builds dev URL from NEXT_PUBLIC_HOST and PORT', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_HOST', '192.168.1.5');
    vi.stubEnv('NEXT_PUBLIC_PORT', '3003');
    const { default: base } = await import('@/lib/ApiEndpoints');
    expect(base).toBe('http://192.168.1.5:3003');
  });
});

describe('ApiEndpoints WS_BASE_URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses the production socket in production', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production');
    const { WS_BASE_URL } = await import('@/lib/ApiEndpoints');
    expect(WS_BASE_URL).toBe('wss://xmobile.com.tm');
  });

  it("uses staging's own socket in a staging production build", async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging');
    vi.stubEnv('NODE_ENV', 'production');
    const { WS_BASE_URL } = await import('@/lib/ApiEndpoints');
    expect(WS_BASE_URL).toBe('wss://dev.xmobile.com.tm');
  });

  it('uses NEXT_PUBLIC_WS_URL locally', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'local');
    vi.stubEnv('NEXT_PUBLIC_WS_URL', 'ws://localhost:4000');
    const { WS_BASE_URL } = await import('@/lib/ApiEndpoints');
    expect(WS_BASE_URL).toBe('ws://localhost:4000');
  });
});
