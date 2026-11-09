import { switchLocale } from '@/pages/lib/switchLocale';
import type { NextRouter } from 'next/router';
import { describe, expect, it, vi } from 'vitest';

describe('switchLocale', () => {
  // Reported bug: switching language dropped the filters, because the query
  // only travelled in `asPath`, which Next doesn't read it from.
  it('keeps every query param, filters included', () => {
    const push = vi.fn();
    const router = {
      pathname: '/product-category/[categorySlug]',
      query: {
        categorySlug: 'phones',
        brandIds: ['b1', 'b2'],
        colors: 'black',
        minPrice: '3000',
        inStock: '1',
      },
      asPath:
        '/product-category/phones?brandIds=b1&brandIds=b2&colors=black&minPrice=3000&inStock=1',
      push,
    } as unknown as NextRouter;

    switchLocale(router, 'tk');

    expect(push).toHaveBeenCalledWith(
      { pathname: router.pathname, query: router.query },
      router.asPath,
      { locale: 'tk' },
    );
  });
});
