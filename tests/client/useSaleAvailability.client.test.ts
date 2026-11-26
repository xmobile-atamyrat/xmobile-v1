// @vitest-environment jsdom

import {
  reportSaleAvailability,
  resetSaleAvailability,
  useSaleAvailability,
} from '@/pages/lib/hooks/useSaleAvailability';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchProductsCount = vi.fn();
vi.mock('@/pages/lib/apis', () => ({
  fetchProductsCount: (...args: unknown[]) => fetchProductsCount(...args),
}));

/** Renders a consumer and lets its deferred request settle. */
async function mountConsumer() {
  const view = renderHook(() => useSaleAvailability());
  await act(async () => {});
  return view;
}

describe('useSaleAvailability', () => {
  beforeEach(() => {
    fetchProductsCount.mockReset();
    resetSaleAvailability();
  });

  it('asks once, however many consumers mount', async () => {
    fetchProductsCount.mockResolvedValue(3);

    const first = renderHook(() => useSaleAvailability());
    const second = await mountConsumer();
    first.unmount();
    const afterNavigation = await mountConsumer();

    expect(second.result.current).toBe(true);
    expect(afterNavigation.result.current).toBe(true);
    expect(fetchProductsCount).toHaveBeenCalledTimes(1);
    expect(fetchProductsCount).toHaveBeenCalledWith({ sale: true });
  });

  it('stays false when nothing is on sale, without asking again', async () => {
    fetchProductsCount.mockResolvedValue(0);

    expect((await mountConsumer()).result.current).toBe(false);
    await mountConsumer();

    expect(fetchProductsCount).toHaveBeenCalledTimes(1);
  });

  it('needs no request when the page reports its own data', async () => {
    const view = renderHook(() => {
      const available = useSaleAvailability();
      return available;
    });
    // Same tick as the mount, as a page's own effect would be.
    reportSaleAvailability(true);
    await act(async () => {});

    expect(view.result.current).toBe(true);
    expect(fetchProductsCount).not.toHaveBeenCalled();
  });

  it('tries again on the next mount after a failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fetchProductsCount.mockRejectedValueOnce(new Error('offline'));
    fetchProductsCount.mockResolvedValue(1);

    expect((await mountConsumer()).result.current).toBe(false);
    expect((await mountConsumer()).result.current).toBe(true);
  });
});
