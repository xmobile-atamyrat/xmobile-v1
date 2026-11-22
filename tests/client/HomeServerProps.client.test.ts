// @vitest-environment jsdom

import { getServerSideProps } from '@/pages/index.page';
import geoip from 'geoip-lite';
import type { GetServerSidePropsContext } from 'next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchProducts = vi.fn();

vi.mock('@/pages/lib/apis', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/pages/lib/apis')>()),
  fetchProducts: (...args: unknown[]) => fetchProducts(...args),
}));

vi.mock('@/lib/promoBanners', () => ({
  getStorefrontBanners: vi.fn().mockResolvedValue([]),
}));

const getHomeBrands = vi.fn();
vi.mock('@/lib/homeBrands', () => ({
  getHomeBrands: () => getHomeBrands(),
}));

vi.mock('geoip-lite', () => ({ default: { lookup: vi.fn() } }));

// Only the server half runs here, and these pull in the whole UI.
vi.mock('@/pages/components/Layout', () => ({ default: vi.fn() }));
vi.mock('@/pages/components/HomePromoTile', () => ({ default: vi.fn() }));
vi.mock('@/pages/components/PopularCategoriesSection', () => ({
  default: vi.fn(),
}));
vi.mock('@/pages/components/ProductCard', () => ({ default: vi.fn() }));
vi.mock('@/pages/components/PromoBannerSection', () => ({ default: vi.fn() }));
vi.mock('@/pages/components/SkeletonLoader', () => ({
  ProductGridSkeleton: vi.fn(),
}));

const newest = [{ id: 'new-1' }];
const picks = [{ id: 'pick-1' }];
const found = [{ id: 'found-1' }];
const brandProducts = [{ id: 'brand-1' }];
const brands = [{ id: 'b1', name: 'Samsung' }];

function mockFetches({
  newestFails = false,
  recommendedFails = false,
  searchFails = false,
  brandFails = false,
}: {
  newestFails?: boolean;
  recommendedFails?: boolean;
  searchFails?: boolean;
  brandFails?: boolean;
}) {
  fetchProducts.mockImplementation(
    async ({
      searchKeyword,
      recommended,
      brandIds,
    }: {
      searchKeyword?: string;
      recommended?: boolean;
      brandIds?: string[];
    }) => {
      if (brandIds) {
        if (brandFails) throw new Error('brand down');
        return brandProducts;
      }
      if (searchKeyword != null) {
        if (searchFails) throw new Error('search down');
        return found;
      }
      if (recommended) {
        if (recommendedFails) throw new Error('recommended down');
        return picks;
      }
      if (newestFails) throw new Error('newest down');
      return newest;
    },
  );
}

async function loadHome(query: Record<string, string | string[]>) {
  const result = await getServerSideProps({
    req: { headers: {}, socket: {} },
    res: { setHeader: vi.fn() },
    query,
    locale: 'en',
    defaultLocale: 'ru',
  } as unknown as GetServerSidePropsContext);
  return (result as { props: Record<string, unknown> }).props;
}

describe('home getServerSideProps', () => {
  beforeEach(() => {
    fetchProducts.mockReset();
    getHomeBrands.mockReset();
    getHomeBrands.mockResolvedValue(brands);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('seeds the newest list and the search results', async () => {
    mockFetches({});

    const props = await loadHome({ searchKeyword: 'iphone' });

    expect(props.initialProducts).toEqual(newest);
    expect(props.initialSearch).toEqual({ term: 'iphone', results: found });
  });

  // Clearing the search is a shallow route change, so nothing would refetch it.
  it('keeps the newest list when the search fails', async () => {
    mockFetches({ searchFails: true });

    const props = await loadHome({ searchKeyword: 'iphone' });

    expect(props.initialProducts).toEqual(newest);
    expect(props.initialSearch).toBeNull();
  });

  it('keeps the search results when the newest list fails', async () => {
    mockFetches({ newestFails: true });

    const props = await loadHome({ searchKeyword: 'iphone' });

    expect(props.initialProducts).toEqual([]);
    expect(props.initialSearch).toEqual({ term: 'iphone', results: found });
  });

  it('does not search without a term', async () => {
    mockFetches({});

    const props = await loadHome({});

    expect(props.initialProducts).toEqual(newest);
    expect(props.initialSearch).toBeNull();
    expect(fetchProducts).toHaveBeenCalledTimes(2);
  });

  it('seeds the picks in-stock, in their order, one section long', async () => {
    mockFetches({});

    const props = await loadHome({});

    expect(props.recommendedProducts).toEqual(picks);
    expect(fetchProducts).toHaveBeenCalledWith({
      page: 1,
      locale: 'en',
      inStock: true,
      recommended: true,
      sortBy: 'recommended',
      limit: 20,
    });
    // The newest list leaves room for the two web promo tiles on top.
    expect(fetchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'newest', limit: 12 }),
    );
  });

  it('keeps the newest list when the picks fail', async () => {
    mockFetches({ recommendedFails: true });

    const props = await loadHome({});

    expect(props.recommendedProducts).toEqual([]);
    expect(props.initialProducts).toEqual(newest);
  });

  it('passes the brands through', async () => {
    mockFetches({});

    const props = await loadHome({});

    expect(props.brands).toEqual(brands);
    expect(props.initialBrand).toBeNull();
  });

  it('seeds the brand in the URL', async () => {
    mockFetches({});

    const props = await loadHome({ brand: 'b1' });

    expect(fetchProducts).toHaveBeenCalledWith({
      page: 1,
      brandIds: ['b1'],
      inStock: true,
      sortBy: 'recommended',
      limit: 20,
      locale: 'en',
    });
    expect(props.initialBrand).toEqual({
      brandId: 'b1',
      products: brandProducts,
    });
  });

  it('uses the first value of a repeated brand param', async () => {
    mockFetches({});

    const props = await loadHome({ brand: ['b1', 'zzz'] });

    expect(props.initialBrand).toEqual({
      brandId: 'b1',
      products: brandProducts,
    });
  });

  it('ignores an unknown brand id', async () => {
    mockFetches({});

    const props = await loadHome({ brand: 'zzz' });

    expect(props.initialBrand).toBeNull();
    expect(fetchProducts).toHaveBeenCalledTimes(2);
  });

  it('keeps the page up when brands fail', async () => {
    mockFetches({});
    getHomeBrands.mockRejectedValue(new Error('db down'));

    const props = await loadHome({ brand: 'b1' });

    expect(props.brands).toEqual([]);
    expect(props.initialBrand).toBeNull();
    expect(props.initialProducts).toEqual(newest);
    expect(props.recommendedProducts).toEqual(picks);
  });

  it('keeps the page up when the brand fetch fails', async () => {
    mockFetches({ brandFails: true });

    const props = await loadHome({ brand: 'b1' });

    expect(props.initialBrand).toBeNull();
    expect(props.brands).toEqual(brands);
    expect(props.initialProducts).toEqual(newest);
  });
});

// GeoIP is the last guess for the language, after the user's pick, the link's
// language and the browser's (the middleware handles those three).
describe('home getServerSideProps GeoIP fallback', () => {
  const CHROME =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const lookup = vi.mocked(geoip.lookup);

  beforeEach(() => {
    fetchProducts.mockReset();
    getHomeBrands.mockReset();
    getHomeBrands.mockResolvedValue(brands);
    mockFetches({});
    lookup.mockReset();
    lookup.mockReturnValue({ country: 'TR' } as ReturnType<
      typeof geoip.lookup
    >);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  function landOnHome({
    headers = {},
    locale = 'ru',
    resolvedUrl = '/',
  }: {
    headers?: Record<string, string>;
    locale?: string;
    resolvedUrl?: string;
  } = {}) {
    const setHeader = vi.fn();
    const result = getServerSideProps({
      req: {
        headers: {
          'user-agent': CHROME,
          'accept-language': 'de-DE,de;q=0.9,en;q=0.8',
          'x-real-ip': '88.255.0.1',
          ...headers,
        },
        socket: {},
      },
      res: { setHeader },
      query: {},
      resolvedUrl,
      locale,
      defaultLocale: 'ru',
    } as unknown as GetServerSidePropsContext);
    return { result, setHeader };
  }

  it('redirects on the server to the country’s language', async () => {
    const { result } = landOnHome();
    expect(await result).toEqual({
      redirect: { destination: '/tr', permanent: false },
    });
  });

  it('keeps the query on the way', async () => {
    const { result } = landOnHome({ resolvedUrl: '/?brand=b1' });
    expect(await result).toEqual({
      redirect: { destination: '/tr?brand=b1', permanent: false },
    });
  });

  it('does not redirect when the country means Russian', async () => {
    lookup.mockReturnValue({ country: 'TM' } as ReturnType<
      typeof geoip.lookup
    >);
    const { result } = landOnHome();
    expect(await result).toHaveProperty('props');
  });

  // A browser in Russian already said Russian; GeoIP must not overrule it.
  it('never overrules a browser language we ship', async () => {
    const { result } = landOnHome({ headers: { 'accept-language': 'ru-RU' } });
    expect(await result).toHaveProperty('props');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('never overrules the user’s pick', async () => {
    const { result } = landOnHome({ headers: { cookie: 'NEXT_LOCALE=ru' } });
    expect(await result).toHaveProperty('props');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('never overrules a link with a language', async () => {
    const { result } = landOnHome({ locale: 'en' });
    expect(await result).toHaveProperty('props');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('serves crawlers the Russian home page as it is', async () => {
    const { result } = landOnHome({
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
    });
    expect(await result).toHaveProperty('props');
    expect(lookup).not.toHaveBeenCalled();
  });

  // Clicking the logo mid-visit must not switch the language.
  it('leaves client-side navigations to home alone', async () => {
    const { result } = landOnHome({ headers: { 'x-nextjs-data': '1' } });
    expect(await result).toHaveProperty('props');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('treats a cookie that is not a locale as no pick, and drops it', async () => {
    const { result, setHeader } = landOnHome({
      headers: { cookie: 'NEXT_LOCALE=xx' },
    });
    expect(await result).toEqual({
      redirect: { destination: '/tr', permanent: false },
    });
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('refreshes a real pick and never stores a guess', async () => {
    const picked = landOnHome({
      headers: { cookie: 'NEXT_LOCALE=tk' },
      locale: 'tk',
    });
    await picked.result;
    expect(picked.setHeader).toHaveBeenCalledWith(
      'Set-Cookie',
      expect.stringContaining('NEXT_LOCALE=tk'),
    );

    lookup.mockReturnValue({ country: 'TM' } as ReturnType<
      typeof geoip.lookup
    >);
    const guessed = landOnHome();
    await guessed.result;
    expect(guessed.setHeader).not.toHaveBeenCalled();
  });
});
