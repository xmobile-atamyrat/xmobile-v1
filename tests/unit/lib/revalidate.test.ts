import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAX_PATHS_PER_BATCH,
  categoryPaths,
  localePaths,
  productCategoryPaths,
  productPaths,
  revalidateInBackground,
  revalidatePaths,
} from '@/lib/revalidate';

function makeRes(impl?: (path: string) => Promise<void>) {
  return {
    revalidate: vi.fn(impl ?? (() => Promise.resolve())),
  } as unknown as Parameters<typeof revalidatePaths>[0] & {
    revalidate: ReturnType<typeof vi.fn>;
  };
}

describe('path builders', () => {
  it('emits one locale-prefixed path per configured locale, in order', () => {
    expect(localePaths('product/iphone-15')).toEqual([
      '/en/product/iphone-15',
      '/ru/product/iphone-15',
      '/tk/product/iphone-15',
      '/ch/product/iphone-15',
      '/tr/product/iphone-15',
    ]);
  });

  it('builds the three ISR routes', () => {
    expect(productPaths('a')[0]).toBe('/en/product/a');
    expect(categoryPaths('a')[0]).toBe('/en/category/a');
    expect(productCategoryPaths('a')[0]).toBe('/en/product-category/a');
  });

  it('returns nothing for a missing slug rather than a path ending in undefined', () => {
    expect(productPaths(null)).toEqual([]);
    expect(categoryPaths(undefined)).toEqual([]);
    expect(productCategoryPaths('')).toEqual([]);
  });
});

describe('revalidatePaths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('revalidates each path once, only for already-generated pages', async () => {
    const res = makeRes();

    await revalidatePaths(res, ['/en/product/a', '/ru/product/a']);

    expect(res.revalidate).toHaveBeenCalledTimes(2);
    expect(res.revalidate).toHaveBeenCalledWith('/en/product/a', {
      unstable_onlyGenerated: true,
    });
    expect(res.revalidate).toHaveBeenCalledWith('/ru/product/a', {
      unstable_onlyGenerated: true,
    });
  });

  it('collapses duplicates before calling revalidate', async () => {
    const res = makeRes();

    await revalidatePaths(res, [
      '/en/product/a',
      '/en/product/a',
      '/ru/product/a',
    ]);

    expect(res.revalidate).toHaveBeenCalledTimes(2);
  });

  it('skips the whole batch when it exceeds the cap, rather than truncating', async () => {
    const res = makeRes();
    const paths = Array.from(
      { length: MAX_PATHS_PER_BATCH + 1 },
      (_, index) => `/en/product/p${index}`,
    );

    await revalidatePaths(res, paths);

    expect(res.revalidate).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('keeps going when one path fails and never rejects', async () => {
    const res = makeRes((path) =>
      path === '/ru/product/a'
        ? Promise.reject(new Error('Invalid response 404'))
        : Promise.resolve(),
    );

    await expect(
      revalidatePaths(res, ['/en/product/a', '/ru/product/a', '/tk/product/a']),
    ).resolves.toBeUndefined();

    expect(res.revalidate).toHaveBeenCalledTimes(3);
    expect(console.warn).toHaveBeenCalled();
  });

  it('warns rather than errors, so a stale page never pages anyone', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes(() => Promise.reject(new Error('boom')));

    await revalidatePaths(res, ['/en/product/a']);

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('does nothing for an empty path list', async () => {
    const res = makeRes();

    await revalidatePaths(res, []);

    expect(res.revalidate).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('never runs more than the concurrency limit at once', async () => {
    let inFlight = 0;
    let peak = 0;
    const res = makeRes(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
    });

    await revalidatePaths(
      res,
      Array.from({ length: 20 }, (_, index) => `/en/product/p${index}`),
    );

    expect(peak).toBeLessThanOrEqual(4);
  });
});

describe('revalidateInBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns synchronously without waiting for the regeneration', () => {
    const res = makeRes(() => new Promise(() => {}));

    expect(revalidateInBackground(res, ['/en/product/a'])).toBeUndefined();
  });

  it('swallows a rejecting batch instead of surfacing an unhandled rejection', async () => {
    const res = makeRes(() => Promise.reject(new Error('boom')));

    revalidateInBackground(res, ['/en/product/a']);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(res.revalidate).toHaveBeenCalledTimes(1);
  });

  it('resolves a thunk and revalidates what it returns', async () => {
    const res = makeRes();

    revalidateInBackground(res, async () => ['/en/product/a', '/ru/product/a']);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(res.revalidate).toHaveBeenCalledTimes(2);
  });

  it('swallows a thunk that throws, so target resolution cannot fail a save', async () => {
    const res = makeRes();

    expect(() =>
      revalidateInBackground(res, () => {
        throw new Error('connection reset');
      }),
    ).not.toThrow();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(res.revalidate).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('swallows a thunk that rejects', async () => {
    const res = makeRes();

    revalidateInBackground(res, () =>
      Promise.reject(new Error('statement timeout')),
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(res.revalidate).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('does not run the thunk synchronously, so the handler returns first', () => {
    const res = makeRes();
    const thunk = vi.fn(async () => ['/en/product/a']);

    revalidateInBackground(res, thunk);

    expect(thunk).not.toHaveBeenCalled();
  });
});
