import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ApiEndpoints BASE_URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses production host in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { default: base } = await import('@/lib/ApiEndpoints');
    expect(base).toBe('https://xmobile.com.tm');
  });

  it('builds dev URL from NEXT_PUBLIC_HOST and PORT', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_HOST', '192.168.1.5');
    vi.stubEnv('NEXT_PUBLIC_PORT', '3003');
    const { default: base } = await import('@/lib/ApiEndpoints');
    expect(base).toBe('http://192.168.1.5:3003');
  });
});
