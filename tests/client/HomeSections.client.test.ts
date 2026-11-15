// @vitest-environment jsdom

import Home from '@/pages/index.page';
import { useBrandProducts } from '@/pages/lib/hooks/useBrandProducts';
import { useHomeSearch } from '@/pages/lib/hooks/useHomeSearch';
import { useImagelessProducts } from '@/pages/lib/hooks/useImagelessProducts';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { fireEvent, screen, within } from '@testing-library/react';
import mockRouter from 'next-router-mock';
import { createElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

vi.mock('@/pages/lib/hooks/useHomeSearch', () => ({
  useHomeSearch: vi.fn(),
}));

vi.mock('@/pages/lib/hooks/useBrandProducts', () => ({
  useBrandProducts: vi.fn(),
}));

vi.mock('@/pages/lib/hooks/useImagelessProducts', () => ({
  useImagelessProducts: vi.fn(() => null),
}));

vi.mock('@/pages/lib/PlatformContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/pages/lib/PlatformContext')>()),
  usePlatform: vi.fn(),
}));

vi.mock('@/lib/promoBanners', () => ({ getStorefrontBanners: vi.fn() }));
vi.mock('@/lib/homeBrands', () => ({ getHomeBrands: vi.fn() }));
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
    brands = [],
  }: {
    newest?: { id: string; name: string }[];
    recommended?: { id: string; name: string }[];
    isSearching?: boolean;
    brands?: { id: string; name: string }[];
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
      brands,
      initialBrand: null,
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

const brandHook = (over: Partial<ReturnType<typeof useBrandProducts>> = {}) =>
  vi.mocked(useBrandProducts).mockReturnValue({
    products: [],
    isLoading: false,
    failed: false,
    retry: vi.fn(),
    ...over,
  });

describe.each(['web', 'mobile'] as const)('home sections on %s', (platform) => {
  beforeEach(() => {
    vi.clearAllMocks();
    // A shopper's view unless a test signs in staff.
    vi.mocked(useImagelessProducts).mockReturnValue(null);
    mockRouter.setCurrentUrl('/');
    brandHook();
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

    expect(viewAllHrefs()).toEqual([
      '/product?recommended=1&sortBy=recommended',
      '/product',
    ]);
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

  it('shows staff the products without photos above the picks', () => {
    vi.mocked(useImagelessProducts).mockReturnValue({
      products: products('Bare', 2),
      total: 7,
    } as never);
    renderHome(platform);

    const title = 'Products without photos (7)';
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings.indexOf(title)).toBeGreaterThanOrEqual(0);
    expect(headings.indexOf(title)).toBeLessThan(
      headings.indexOf('Recommended products'),
    );
    expect(cardNames(sectionOf(title))).toEqual(['Bare 0', 'Bare 1']);
    expect(viewAllHrefs()[0]).toBe('/product?imageless=1');
  });

  it('has no products-without-photos section for everyone else', () => {
    renderHome(platform);

    expect(
      screen.queryByRole('heading', { name: /Products without photos/ }),
    ).not.toBeInTheDocument();
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

describe('brand chips on mobile', () => {
  const brands = [
    { id: 'b1', name: 'Samsung' },
    { id: 'b2', name: 'Apple' },
  ];
  const h2s = () =>
    screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useImagelessProducts).mockReturnValue(null);
    mockRouter.setCurrentUrl('/');
    brandHook({ products: products('Galaxy', 2) as never });
  });

  it('orders sections: categories, brands, recommended, new', () => {
    renderHome('mobile', { brands });

    expect(h2s()).toEqual(['Recommended products', 'New Products']);
    const order = screen
      .getAllByText(/Choose a brand|Recommended products|New Products/)
      .map((node) => node.textContent);
    expect(order).toEqual([
      'Choose a brand',
      'Recommended products',
      'New Products',
    ]);
  });

  it('selecting a brand swaps Recommended for that brand', () => {
    renderHome('mobile', { brands });

    fireEvent.click(screen.getByRole('button', { name: 'Samsung' }));

    expect(mockRouter.query.brand).toBe('b1');
    expect(
      screen.queryByRole('heading', { name: 'Recommended products' }),
    ).not.toBeInTheDocument();
    expect(cardNames(sectionOf('Samsung'))).toEqual(['Galaxy 0', 'Galaxy 1']);
    expect(viewAllHrefs()).toEqual(['/product?brandIds=b1', '/product']);
    expect(
      screen.getByRole('heading', { name: 'New Products' }),
    ).toBeInTheDocument();
  });

  it('tapping the selected brand brings Recommended back', () => {
    mockRouter.setCurrentUrl('/?brand=b1&x=1');
    renderHome('mobile', { brands });

    fireEvent.click(screen.getByRole('button', { name: 'Samsung' }));

    expect(mockRouter.query.brand).toBeUndefined();
    expect(mockRouter.query.x).toBe('1');
    expect(
      screen.getByRole('heading', { name: 'Recommended products' }),
    ).toBeInTheDocument();
  });

  it('preselects the brand from ?brand=', () => {
    mockRouter.setCurrentUrl('/?brand=b1');
    renderHome('mobile', { brands });

    expect(screen.getByRole('button', { name: 'Samsung' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(h2s()[0]).toBe('Samsung');
  });

  it('treats an unknown ?brand= as none', () => {
    mockRouter.setCurrentUrl('/?brand=zzz');
    renderHome('mobile', { brands });

    expect(h2s()[0]).toBe('Recommended products');
  });

  it('shows retry when the brand fetch fails', () => {
    const retry = vi.fn();
    brandHook({ failed: true, retry });
    mockRouter.setCurrentUrl('/?brand=b1');
    renderHome('mobile', { brands });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows no-products text for an empty brand', () => {
    brandHook({ products: [] });
    mockRouter.setCurrentUrl('/?brand=b1');
    renderHome('mobile', { brands });

    expect(screen.getByText('No Products Found!')).toBeInTheDocument();
  });

  it('hides brands and categories while searching', () => {
    mockRouter.setCurrentUrl('/?searchKeyword=iphone');
    renderHome('mobile', { brands, isSearching: true });

    expect(screen.queryByText('Choose a brand')).not.toBeInTheDocument();
  });

  it('has no brand strip on web', () => {
    renderHome('web', { brands });

    expect(screen.queryByText('Choose a brand')).not.toBeInTheDocument();
  });
});
