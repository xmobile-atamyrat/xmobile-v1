import BASE_URL from '@/lib/ApiEndpoints';
import {
  BrandProps,
  ExtendedProduct,
  PromoBannerData,
  ResponseApi,
} from '@/pages/lib/types';
import { Color, Prices, Product } from '@prisma/client';

export interface ProductFilterOptions {
  colors: string[]; // colorIds in use
}

export const fetchProducts = async ({
  categoryIds,
  brandIds,
  colorIds,
  minPrice,
  maxPrice,
  sortBy,
  searchKeyword,
  productId,
  productSlug,
  page,
  locale,
}: {
  categoryIds?: string[];
  brandIds?: string[];
  colorIds?: string[];
  minPrice?: string;
  maxPrice?: string;
  sortBy?: string;
  searchKeyword?: string;
  productId?: string;
  productSlug?: string;
  page?: number;
  /**
   * When set, the API strips names/descriptions down to this locale.
   * Leave unset for admin flows that need the raw multi-locale JSON
   * (e.g. AddEditProductDialog pre-filling all language fields).
   */
  locale?: string;
}): Promise<ExtendedProduct[]> => {
  let url = `${BASE_URL}/api/product?page=${page || 1}`;

  // Helper to append params
  const appendParam = (key: string, val: any) => {
    if (val) url += `&${key}=${encodeURIComponent(val)}`;
  };

  if (brandIds && brandIds.length > 0) {
    brandIds.forEach((bid) => appendParam('brandIds', bid));
  }

  if (categoryIds && categoryIds.length > 0) {
    categoryIds.forEach((cid) => appendParam('categoryIds', cid));
  }

  if (colorIds && colorIds.length > 0) {
    colorIds.forEach((cid) => appendParam('colorIds', cid));
  }

  appendParam('maxPrice', maxPrice);
  appendParam('minPrice', minPrice);
  appendParam('productId', productId);
  appendParam('productSlug', productSlug);
  appendParam('searchKeyword', searchKeyword);
  appendParam('sortBy', sortBy);
  appendParam('locale', locale);

  const { success, data, message }: ResponseApi<ExtendedProduct[]> = await (
    await fetch(url)
  ).json();
  if (!success || data == null) {
    throw new Error(message);
  }
  return Array.isArray(data) ? data : [data];
};

/** All product slugs for SSG (e.g. getStaticPaths); uses /api/product/slugs */
export const fetchAllProductSlugs = async (): Promise<string[]> => {
  const { success, data, message }: ResponseApi<string[]> = await (
    await fetch(`${BASE_URL}/api/product/slugs`)
  ).json();
  if (!success || data == null) {
    throw new Error(message ?? 'Failed to fetch product slugs');
  }
  return data;
};

// todo: legacy func, fetchProducts applies default sortBy=newest parameter
export const fetchNewProducts = async ({
  searchKeyword,
  page,
}: {
  searchKeyword?: string;
  page?: number;
}): Promise<Product[]> => {
  let url = `${BASE_URL}/api/product/new?page=${page || 1}`;
  if (searchKeyword) {
    url += `&searchKeyword=${encodeURIComponent(searchKeyword)}`;
  }

  const { success, data, message }: ResponseApi<Product[]> = await (
    await fetch(url)
  ).json();
  if (!success || data == null) {
    throw new Error(message);
  }
  return Array.isArray(data) ? data : [];
};

export const fetchBrands = async (): Promise<BrandProps[]> => {
  const { success, data, message }: ResponseApi<any[]> = await (
    await fetch(`${BASE_URL}/api/brand`)
  ).json();

  if (!success || data == null) {
    console.error('Failed to fetch brands:', message);
    return [];
  }
  return data;
};

export const fetchColors = async (): Promise<Color[]> => {
  const { success, data, message }: ResponseApi<Color[]> = await (
    await fetch(`${BASE_URL}/api/colors`)
  ).json();

  if (!success || data == null) {
    console.error('Failed to fetch colors:', message);
    return [];
  }
  return data;
};

export const fetchPrices = async (): Promise<Prices[]> => {
  const { success, data, message }: ResponseApi<Prices[]> = await (
    await fetch(`${BASE_URL}/api/prices`)
  ).json();

  if (!success || data == null) {
    console.error('Failed to fetch prices:', message);
    return [];
  }
  return data;
};

/** Admin: all non-deleted banners (incl. inactive / scheduled). Requires staff token. */
export const fetchAllBanners = async (
  accessToken: string | undefined,
): Promise<PromoBannerData[]> => {
  const { success, data, message }: ResponseApi<PromoBannerData[]> = await (
    await fetch(`${BASE_URL}/api/promo-banner?all=true`, {
      credentials: 'include',
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    })
  ).json();
  if (!success || data == null) {
    console.error('Failed to fetch banners:', message);
    return [];
  }
  return data;
};

/** Public: active banners within their schedule window. */
export const fetchActiveBanners = async (): Promise<PromoBannerData[]> => {
  const { success, data, message }: ResponseApi<PromoBannerData[]> = await (
    await fetch(`${BASE_URL}/api/promo-banner`)
  ).json();
  if (!success || data == null) {
    console.error('Failed to fetch banners:', message);
    return [];
  }
  return data;
};

export const deleteBanner = async (
  id: string,
  accessToken: string | undefined,
): Promise<boolean> => {
  const { success, message }: ResponseApi = await (
    await fetch(`${BASE_URL}/api/promo-banner?id=${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    })
  ).json();
  if (!success) {
    throw new Error(message || 'Failed to delete banner');
  }
  return success;
};

export const fetchProductFilterOptions =
  async (): Promise<ProductFilterOptions> => {
    const { success, data, message }: ResponseApi<ProductFilterOptions> =
      await (await fetch(`${BASE_URL}/api/product/filters`)).json();

    if (!success || data == null) {
      console.error('Failed to fetch product filter options:', message);
      return { colors: [] };
    }
    return data;
  };
