import dbClient from '@/lib/dbClient';
import { whereActiveBanner } from '@/lib/prismaActiveScope';
import { BannerImgUrls, StorefrontBanner } from '@/pages/lib/types';
import { PromoBanner } from '@prisma/client';

export type { BannerImgUrls, StorefrontBanner };

export interface ResolvedBanner extends Omit<PromoBanner, 'imgUrls'> {
  imgUrls: BannerImgUrls;
  /** Single-target UI shape derived from the redirectCategoryId/redirectProductId relations. */
  redirectType: 'CATEGORY' | 'PRODUCT' | null;
  redirectId: string | null;
  /** Resolved internal deep-link (/category/[slug] or /product/[slug]) or null. */
  redirectUrl: string | null;
}

/** Collapse the two relation columns into the single-target shape the UI/API use. */
export function deriveBannerRedirect(banner: {
  redirectCategoryId: string | null;
  redirectProductId: string | null;
}): { redirectType: 'CATEGORY' | 'PRODUCT' | null; redirectId: string | null } {
  if (banner.redirectCategoryId)
    return { redirectType: 'CATEGORY', redirectId: banner.redirectCategoryId };
  if (banner.redirectProductId)
    return { redirectType: 'PRODUCT', redirectId: banner.redirectProductId };
  return { redirectType: null, redirectId: null };
}

const bannerOrderBy = [
  { sortOrder: 'asc' as const },
  { createdAt: 'desc' as const },
];

/** Build a bannerId -> resolved internal URL map from current category/product slugs. */
async function resolveRedirectUrls(
  banners: PromoBanner[],
): Promise<Map<string, string | null>> {
  const categoryIds = banners
    .filter((b) => b.redirectCategoryId)
    .map((b) => b.redirectCategoryId as string);
  const productIds = banners
    .filter((b) => b.redirectProductId)
    .map((b) => b.redirectProductId as string);

  const [categories, products] = await Promise.all([
    categoryIds.length
      ? dbClient.category.findMany({
          where: { id: { in: categoryIds }, deletedAt: null },
          select: { id: true, slug: true },
        })
      : Promise.resolve([]),
    productIds.length
      ? dbClient.product.findMany({
          where: { id: { in: productIds }, deletedAt: null },
          select: { id: true, slug: true },
        })
      : Promise.resolve([]),
  ]);

  const categorySlug = new Map(categories.map((c) => [c.id, c.slug]));
  const productSlug = new Map(products.map((p) => [p.id, p.slug]));

  const result = new Map<string, string | null>();
  banners.forEach((b) => {
    if (b.redirectCategoryId) {
      const slug = categorySlug.get(b.redirectCategoryId);
      result.set(b.id, slug ? `/category/${slug}` : null);
    } else if (b.redirectProductId) {
      const slug = productSlug.get(b.redirectProductId);
      result.set(b.id, slug ? `/product/${slug}` : null);
    } else {
      result.set(b.id, null);
    }
  });
  return result;
}

function toResolved(
  banner: PromoBanner,
  redirectUrls: Map<string, string | null>,
): ResolvedBanner {
  return {
    ...banner,
    imgUrls: banner.imgUrls as unknown as BannerImgUrls,
    ...deriveBannerRedirect(banner),
    redirectUrl: redirectUrls.get(banner.id) ?? null,
  };
}

/** Public storefront banners: active and within their schedule window, ordered for the carousel. */
export async function getActiveBanners(
  now: Date = new Date(),
): Promise<ResolvedBanner[]> {
  const banners = await dbClient.promoBanner.findMany({
    where: {
      ...whereActiveBanner,
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: bannerOrderBy,
  });
  const redirectUrls = await resolveRedirectUrls(banners);
  return banners.map((b) => toResolved(b, redirectUrls));
}

/** Admin list: all non-deleted banners (incl. inactive / out-of-window). */
export async function getAllBanners(): Promise<ResolvedBanner[]> {
  const banners = await dbClient.promoBanner.findMany({
    where: { ...whereActiveBanner },
    orderBy: bannerOrderBy,
  });
  const redirectUrls = await resolveRedirectUrls(banners);
  return banners.map((b) => toResolved(b, redirectUrls));
}

/** Slim, serializable banners for the given locale (image override falls back to default). */
export async function getStorefrontBanners(
  locale: string | undefined,
): Promise<StorefrontBanner[]> {
  const banners = await getActiveBanners();
  return banners.map((b) => ({
    id: b.id,
    imgUrl: (locale && b.imgUrls[locale]) || b.imgUrls.default,
    redirectUrl: b.redirectUrl,
  }));
}
