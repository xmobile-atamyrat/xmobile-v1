// @vitest-environment jsdom

import Home from '@/pages/index.page';
import { useHomeSearch } from '@/pages/lib/hooks/useHomeSearch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { fireEvent, screen } from '@testing-library/react';
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
  default: (): null => null,
}));
vi.mock('@/pages/components/PopularCategoriesSection', () => ({
  default: (): null => null,
}));
vi.mock('@/pages/components/ProductCard', () => ({
  default: (): null => null,
}));
vi.mock('@/pages/components/PromoBannerSection', () => ({
  default: (): null => null,
}));
vi.mock('@/pages/components/SkeletonLoader', () => ({
  ProductGridSkeleton: (): null => null,
}));

const retry = vi.fn();

function renderHome(platform: 'web' | 'mobile', failed: boolean) {
  vi.mocked(usePlatform).mockReturnValue(platform);
  vi.mocked(useHomeSearch).mockReturnValue({
    isSearching: true,
    results: [],
    isLoading: false,
    hasMore: false,
    failed,
    retry,
    sentinelRef: { current: null },
  });
  return renderWithProviders(
    createElement(Home, {
      locale: null,
      banners: [],
      initialProducts: [],
      initialSearch: null,
    } as never),
  );
}

describe.each(['web', 'mobile'] as const)('home search on %s', (platform) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter.setCurrentUrl('/?searchKeyword=iphone');
  });

  it('says the search failed instead of finding nothing', () => {
    renderHome(platform, true);

    expect(screen.getByText("Couldn't load the results")).toBeInTheDocument();
    expect(screen.queryByText('No Products Found!')).not.toBeInTheDocument();
  });

  it('retries from the failure message', () => {
    renderHome(platform, true);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('still says nothing was found after a search that worked', () => {
    renderHome(platform, false);

    expect(screen.getByText('No Products Found!')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
  });
});
