import { afterEach, describe, expect, it, vi } from 'vitest';

describe('fetchTelekomBalance', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns null when credentials are missing', async () => {
    vi.resetModules();
    const u = process.env.TELEKOM_USERNAME;
    const p = process.env.TELEKOM_PASSWORD;
    delete process.env.TELEKOM_USERNAME;
    delete process.env.TELEKOM_PASSWORD;
    try {
      const { fetchTelekomBalance } = await import('@/lib/telekom');
      expect(await fetchTelekomBalance()).toBeNull();
    } finally {
      if (u !== undefined) process.env.TELEKOM_USERNAME = u;
      if (p !== undefined) process.env.TELEKOM_PASSWORD = p;
    }
  });

  it('returns floored balance after login + client calls', async () => {
    vi.stubEnv('TELEKOM_USERNAME', 'u');
    vi.stubEnv('TELEKOM_PASSWORD', 'p');

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: { accessToken: 'tok' } }),
    } as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: { client: { balance: 123.789 } },
      }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const { fetchTelekomBalance } = await import('@/lib/telekom');
    expect(await fetchTelekomBalance()).toBe(123);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when login is not ok', async () => {
    vi.stubEnv('TELEKOM_USERNAME', 'u');
    vi.stubEnv('TELEKOM_PASSWORD', 'p');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      } as Response),
    );

    const { fetchTelekomBalance } = await import('@/lib/telekom');
    await expect(fetchTelekomBalance()).rejects.toThrow(
      'Telekom login request failed',
    );
  });
});
