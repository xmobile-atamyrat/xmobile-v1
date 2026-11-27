// @vitest-environment node

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  flush,
  initAnalytics,
  track,
  trackEntityView,
  trackPageView,
  useCategoryView,
  useProductView,
} from '@/lib/analytics/client';

describe('analytics client on the server', () => {
  it('runs in a window-less environment', () => {
    expect(typeof window).toBe('undefined');
  });

  it('is a no-op that never throws', () => {
    expect(() => track('product_view', { productId: 'p1' })).not.toThrow();
    expect(() => trackPageView('/product/x')).not.toThrow();
    expect(() => trackEntityView('category_view', 'c1')).not.toThrow();
    expect(() => flush()).not.toThrow();
    const teardown = initAnalytics();
    expect(typeof teardown).toBe('function');
    expect(() => teardown()).not.toThrow();
  });

  it('lets pages using the view hooks render to a string', () => {
    function Page() {
      useProductView('p1');
      useCategoryView('c1');
      return createElement('main', null, 'ok');
    }
    expect(renderToString(createElement(Page))).toContain('ok');
  });
});
