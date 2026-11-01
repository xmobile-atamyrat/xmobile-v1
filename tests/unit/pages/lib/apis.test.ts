import { fetchCategories, fetchColors } from '@/pages/lib/apis';
import { afterEach, describe, expect, it, vi } from 'vitest';

const respond = (data: unknown) =>
  ({ json: async () => ({ success: true, data }) }) as Response;

describe('shared reference requests', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gives concurrent callers one request', async () => {
    const fetchMock = vi.fn(async () => respond([{ id: 'c1' }]));
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([fetchColors(), fetchColors()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual([{ id: 'c1' }]);
    expect(second).toBe(first);
  });

  it('asks the server again once the request has settled', async () => {
    const fetchMock = vi.fn(async () => respond([]));
    vi.stubGlobal('fetch', fetchMock);

    await fetchColors();
    await fetchColors();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('asks again after a failed request', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(respond([{ id: 'root' }]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCategories()).rejects.toThrow('offline');
    await expect(fetchCategories()).resolves.toMatchObject({
      data: [{ id: 'root' }],
    });
  });
});
