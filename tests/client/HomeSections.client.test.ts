// @vitest-environment jsdom

import Home from '@/pages/index.page';
import { useHomeSearch } from '@/pages/lib/hooks/useHomeSearch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { screen, within } from '@testing-library/react';
import mockRouter from 'next-router-mock';
import { createElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/hooks/useHomeSearch', () => ({
  useHomeSearch: vi.fn(),
}));

vi.mock('@/pages/lib/PlatformContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/pages/lib/PlatformContext')>()),
  usePlatform: vi.fn(),
}));

vi.mock('@/lib/promoBanners', () => ({ getStorefrontBanners: vi.fn() }));
vi.mock('geoip-lite', () => ({ default: { lookup: vi.fn() } }));

vi.mock('@/pages/components/Layout', () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/pages/components/HomePromoTile', () => ({
  default: ({ product }: { product: { name: string } }) =>
    createElement('div', { 'data-testid': 'promo' }, product.name),
}));
vi.mock('@/pages/components/PopularCategoriesSection', () => ({
  default: (): null => null,
}));
vi.mock('@/pages/components/ProductCard', () => ({
  default: ({ product }: { product: { name: string } }) =>
    createElement('div', { 'data-testid': 'card' }, product.name),
}));
vi.mock('@/pages/components/PromoBannerSection', () => ({
  default: (): null => null,
}));
vi.mock('@/pages/components/SkeletonLoader', () => ({
  ProductGridSkeleton: (): null => null,
}));

const products = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    name: `${prefix} ${i}`,
  }));

function renderHome(
  platform: 'web' | 'mobile',
  {
    newest = products('New', 12),
    recommended = products('Pick', 3),
    isSearching = false,
  }: {
    newest?: { id: string; name: string }[];
    recommended?: { id: string; name: string }[];
    isSearching?: boolean;
  } = {},
) {
  vi.mocked(usePlatform).mockReturnValue(platform);
  vi.mocked(useHomeSearch).mockReturnValue({
    isSearching,
    results: [],
    isLoading: false,
    hasMore: false,
    failed: false,
    retry: vi.fn(),
    sentinelRef: { current: null },
  });
  return renderWithProviders(
    createElement(Home, {
      locale: null,
      banners: [],
      initialProducts: newest,
      recommendedProducts: recommended,
      initialSearch: null,
    } as never),
    { locale: 'en' },
  );
}

/** The heading's section: the nearest ancestor that also holds cards. */
const sectionOf = (title: string) => {
  let node = screen.getByRole('heading', { name: title }).parentElement;
  while (node && within(node).queryAllByTestId('card').length === 0) {
    node = node.parentElement;
  }
  return node as HTMLElement;
};

const cardNames = (section: HTMLElement) =>
  within(section)
    .getAllByTestId('card')
    .map((card) => card.textContent);

// Only the product sections' links: web also has one for categories.
const viewAllHrefs = () =>
  screen
    .queryAllByRole('link', { name: 'View all' })
    .map((link) => link.getAttribute('href'))
    .filter((href) => href?.startsWith('/product'));

describe.each(['web', 'mobile'] as const)('home sections on %s', (platform) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter.setCurrentUrl('/');
  });

  it('shows the picks in their order above the newest products', () => {
    renderHome(platform);

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings.indexOf('Recommended products')).toBeLessThan(
      headings.indexOf('New Products'),
    );
    expect(cardNames(sectionOf('Recommended products'))).toEqual([
      'Pick 0',
      'Pick 1',
      'Pick 2',
    ]);
  });

  it('gives each section a view all link to the matching listing', () => {
    renderHome(platform);

    expect(viewAllHrefs()).toEqual(['/product?sortBy=recommended', '/product']);
  });

  it('caps the newest section at ten cards', () => {
    renderHome(platform);

    // On web the first two newest are promo tiles, so the grid starts after.
    const first = platform === 'web' ? 2 : 0;
    expect(cardNames(sectionOf('New Products'))).toEqual(
      products('New', 12)
        .slice(first, first + 10)
        .map(({ name }) => name),
    );
  });

  it('leaves the recommended section out when nothing is picked', () => {
    renderHome(platform, { recommended: [] });

    expect(
      screen.queryByRole('heading', { name: 'Recommended products' }),
    ).not.toBeInTheDocument();
    expect(viewAllHrefs()).toEqual(['/product']);
  });

  it('has no show more button under the grids', () => {
    renderHome(platform);

    expect(
      screen.queryByRole('link', { name: 'Show more' }),
    ).not.toBeInTheDocument();
  });
});

describe('home sections while searching on mobile', () => {
  it('hides both sections behind the results', () => {
    mockRouter.setCurrentUrl('/?searchKeyword=iphone');
    renderHome('mobile', { isSearching: true });

    expect(
      screen.queryByRole('heading', { name: 'Recommended products' }),
    ).not.toBeInTheDocument();
    expect(viewAllHrefs()).toEqual([]);
  });
});
