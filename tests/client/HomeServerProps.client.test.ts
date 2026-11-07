// @vitest-environment jsdom

import { getServerSideProps } from '@/pages/index.page';
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
const found = [{ id: 'found-1' }];

function mockFetches({
  newestFails = false,
  searchFails = false,
}: {
  newestFails?: boolean;
  searchFails?: boolean;
}) {
  fetchProducts.mockImplementation(
    async ({ searchKeyword }: { searchKeyword?: string }) => {
      if (searchKeyword != null) {
        if (searchFails) throw new Error('search down');
        return found;
      }
      if (newestFails) throw new Error('newest down');
      return newest;
    },
  );
}

async function loadHome(query: Record<string, string>) {
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
    expect(fetchProducts).toHaveBeenCalledTimes(1);
  });
});
