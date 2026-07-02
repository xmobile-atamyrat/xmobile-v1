import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock('@/lib/dbClient', () => ({
  default: {
    promoBanner: { findMany: mockFindMany },
    category: { findMany: vi.fn().mockResolvedValue([]) },
    product: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import dbClient from '@/lib/dbClient';
import {
  deriveBannerRedirect,
  getActiveBanners,
  getAllBanners,
  getStorefrontBanners,
} from '@/lib/promoBanners';

function makeBanner(overrides: Record<string, unknown> = {}) {
  const base = {
    id: 'banner-1',
    imgUrls: { default: '/images/banners/a.jpg' },
    redirectProductId: null as string | null,
    redirectCategoryId: null as string | null,
    isActive: true,
    sortOrder: 0,
    startsAt: null as Date | null,
    endsAt: null as Date | null,
    deletedAt: null as Date | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...base, ...overrides };
}

describe('deriveBannerRedirect', () => {
  it('prefers category over product when both somehow set', () => {
    expect(
      deriveBannerRedirect({
        redirectCategoryId: 'cat-1',
        redirectProductId: 'prod-1',
      }),
    ).toEqual({ redirectType: 'CATEGORY', redirectId: 'cat-1' });
  });

  it('resolves a product redirect', () => {
    expect(
      deriveBannerRedirect({
        redirectCategoryId: null,
        redirectProductId: 'prod-1',
      }),
    ).toEqual({ redirectType: 'PRODUCT', redirectId: 'prod-1' });
  });

  it('resolves no redirect', () => {
    expect(
      deriveBannerRedirect({
        redirectCategoryId: null,
        redirectProductId: null,
      }),
    ).toEqual({ redirectType: null, redirectId: null });
  });
});

describe('getActiveBanners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes the query to active, non-deleted, in-window banners', async () => {
    mockFindMany.mockResolvedValue([]);
    const now = new Date('2026-01-01T00:00:00Z');
    await getActiveBanners(now);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          isActive: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        }),
      }),
    );
  });

  it('resolves imgUrls and redirect fields on returned banners', async () => {
    mockFindMany.mockResolvedValue([makeBanner()]);
    const [banner] = await getActiveBanners();
    expect(banner.imgUrls).toEqual({ default: '/images/banners/a.jpg' });
    expect(banner.redirectType).toBeNull();
    expect(banner.redirectUrl).toBeNull();
  });
});

describe('getAllBanners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes the query to non-deleted banners only, regardless of isActive/window', async () => {
    mockFindMany.mockResolvedValue([]);
    await getAllBanners();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } }),
    );
  });
});

describe('getStorefrontBanners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to the default image when no locale override exists', async () => {
    mockFindMany.mockResolvedValue([
      makeBanner({ imgUrls: { default: '/images/banners/a.jpg' } }),
    ]);
    const [banner] = await getStorefrontBanners('ru');
    expect(banner.imgUrl).toBe('/images/banners/a.jpg');
  });

  it('uses the locale-specific override when present', async () => {
    mockFindMany.mockResolvedValue([
      makeBanner({
        imgUrls: {
          default: '/images/banners/a.jpg',
          ru: '/images/banners/a-ru.jpg',
        },
      }),
    ]);
    const [banner] = await getStorefrontBanners('ru');
    expect(banner.imgUrl).toBe('/images/banners/a-ru.jpg');
  });

  it('resolves the redirect URL from the live category/product slug', async () => {
    mockFindMany.mockResolvedValue([
      makeBanner({ redirectCategoryId: 'cat-1' }),
    ]);
    vi.mocked(dbClient.category.findMany).mockResolvedValue([
      { id: 'cat-1', slug: 'phones' },
    ] as never);

    const [banner] = await getStorefrontBanners('en');
    expect(banner.redirectUrl).toBe('/category/phones');
  });
});
