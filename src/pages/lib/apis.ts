import BASE_URL from '@/lib/ApiEndpoints';
import {
  BrandProps,
  ExtendedCategory,
  ExtendedProduct,
  PriceWithOwner,
  PromoBannerData,
  ResponseApi,
} from '@/pages/lib/types';
import { ColorFamily } from '@/pages/lib/colorFamilies';
import { Color } from '@prisma/client';

export interface ProductFilterOptions {
  colors: string[]; // colorIds in use
  colorFamilies: ColorFamily[];
  brandIds: string[];
}

export const fetchProducts = async ({
  categoryIds,
  brandIds,
  colors,
  minPrice,
  maxPrice,
  sortBy,
  searchKeyword,
  productId,
  productSlug,
  page,
  locale,
  inStock,
}: {
  categoryIds?: string[];
  brandIds?: string[];
  /** Colour family names, e.g. `black`; the API resolves them to colours. */
  colors?: string[];
  minPrice?: string;
  maxPrice?: string;
  sortBy?: string;
  inStock?: boolean;
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

  colors?.forEach((family) => appendParam('colors', family));

  appendParam('maxPrice', maxPrice);
  appendParam('minPrice', minPrice);
  appendParam('productId', productId);
  appendParam('productSlug', productSlug);
  appendParam('searchKeyword', searchKeyword);
  appendParam('sortBy', sortBy);
  appendParam('locale', locale);
  appendParam('inStock', inStock ? '1' : undefined);

  const { success, data, message }: ResponseApi<ExtendedProduct[]> = await (
    await fetch(url)
  ).json();
  if (!success || data == null) {
    throw new Error(message);
  }
  return Array.isArray(data) ? data : [data];
};

/** Total number of products matching a filter set (ignores pagination). */
export const fetchProductsCount = async ({
  categoryIds,
  brandIds,
  colors,
  minPrice,
  maxPrice,
  searchKeyword,
  inStock,
}: {
  categoryIds?: string[];
  brandIds?: string[];
  /** Colour family names, e.g. `black`; the API resolves them to colours. */
  colors?: string[];
  minPrice?: string;
  maxPrice?: string;
  searchKeyword?: string;
  inStock?: boolean;
}): Promise<number> => {
  let url = `${BASE_URL}/api/product?count=true`;
  const appendParam = (key: string, val: any) => {
    if (val) url += `&${key}=${encodeURIComponent(val)}`;
  };
  brandIds?.forEach((bid) => appendParam('brandIds', bid));
  categoryIds?.forEach((cid) => appendParam('categoryIds', cid));
  colors?.forEach((family) => appendParam('colors', family));
  appendParam('maxPrice', maxPrice);
  appendParam('minPrice', minPrice);
  appendParam('searchKeyword', searchKeyword);
  appendParam('inStock', inStock ? '1' : undefined);

  const { success, data }: ResponseApi<number> = await (
    await fetch(url)
  ).json();
  if (!success || typeof data !== 'number') {
    throw new Error('Failed to fetch product count');
  }
  return data;
};

export interface CategoryFacet {
  categoryId: string;
  count: number;
}

/**
 * Per-category breakdown of a filter set, for the search results' category
 * pills. Deliberately takes no `categoryIds`: a facet computed with its own
 * dimension applied would report 0 for every category except the selected one.
 */
export const fetchCategoryFacets = async ({
  brandIds,
  colors,
  minPrice,
  maxPrice,
  searchKeyword,
  inStock,
}: {
  brandIds?: string[];
  /** Colour family names, e.g. `black`; the API resolves them to colours. */
  colors?: string[];
  minPrice?: string;
  maxPrice?: string;
  searchKeyword?: string;
  inStock?: boolean;
}): Promise<CategoryFacet[]> => {
  let url = `${BASE_URL}/api/product?facets=categories`;
  const appendParam = (key: string, val: any) => {
    if (val) url += `&${key}=${encodeURIComponent(val)}`;
  };
  brandIds?.forEach((bid) => appendParam('brandIds', bid));
  colors?.forEach((family) => appendParam('colors', family));
  appendParam('maxPrice', maxPrice);
  appendParam('minPrice', minPrice);
  appendParam('searchKeyword', searchKeyword);
  appendParam('inStock', inStock ? '1' : undefined);

  const { success, data }: ResponseApi<CategoryFacet[]> = await (
    await fetch(url)
  ).json();
  if (!success || !Array.isArray(data)) {
    throw new Error('Failed to fetch category facets');
  }
  return data;
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

// Several components ask for the same reference list on one page load; they
// share the request in flight. Nothing is kept once it settles, so the next
// call (a later page, or a refresh after an admin edit) goes to the server.
const inFlight = new Map<string, Promise<unknown>>();

const shareInFlight = <T>(key: string, load: () => Promise<T>): Promise<T> => {
  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const request = load().finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
};

export const fetchCategories = () =>
  shareInFlight(
    'categories',
    async (): Promise<ResponseApi<ExtendedCategory[]>> =>
      (await fetch(`${BASE_URL}/api/category`)).json(),
  );

const loadBrands = async (): Promise<BrandProps[]> => {
  const { success, data, message }: ResponseApi<any[]> = await (
    await fetch(`${BASE_URL}/api/brand`)
  ).json();

  if (!success || data == null) {
    console.error('Failed to fetch brands:', message);
    return [];
  }
  return data;
};

export const fetchBrands = () => shareInFlight('brands', loadBrands);

const loadColors = async (): Promise<Color[]> => {
  const { success, data, message }: ResponseApi<Color[]> = await (
    await fetch(`${BASE_URL}/api/colors`)
  ).json();

  if (!success || data == null) {
    console.error('Failed to fetch colors:', message);
    return [];
  }
  return data;
};

export const fetchColors = () => shareInFlight('colors', loadColors);

/**
 * Prices, optionally narrowed. `productId` returns just that product's
 * connected prices; `unassigned` returns prices no product owns yet (what the
 * connect-price search offers); `categoryId` returns every price in one
 * category, taken ones included, which is what the product form's picker shows.
 * No options -> the whole price list, as before.
 */
export const fetchPrices = async (options?: {
  productId?: string;
  unassigned?: boolean;
  searchKeyword?: string;
  categoryId?: string;
}): Promise<PriceWithOwner[]> => {
  const params = new URLSearchParams();
  if (options?.productId != null) params.set('productId', options.productId);
  if (options?.unassigned) params.set('unassigned', 'true');
  if (options?.searchKeyword)
    params.set('searchKeyword', options.searchKeyword);
  if (options?.categoryId != null) params.set('categoryId', options.categoryId);
  const query = params.toString();

  const { success, data, message }: ResponseApi<PriceWithOwner[]> = await (
    await fetch(`${BASE_URL}/api/prices${query ? `?${query}` : ''}`)
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

/**
 * The brands and colour families that still match the rest of a filter set,
 * so the rail never offers a choice that empties the list.
 */
export const fetchProductFilterOptions = async ({
  categoryIds,
  brandIds,
  colors,
  minPrice,
  maxPrice,
  searchKeyword,
  inStock,
}: {
  categoryIds?: string[];
  brandIds?: string[];
  colors?: string[];
  minPrice?: string;
  maxPrice?: string;
  searchKeyword?: string;
  inStock?: boolean;
}): Promise<ProductFilterOptions> => {
  const params = new URLSearchParams();
  categoryIds?.forEach((cid) => params.append('categoryIds', cid));
  brandIds?.forEach((bid) => params.append('brandIds', bid));
  colors?.forEach((family) => params.append('colors', family));
  if (minPrice) params.set('minPrice', minPrice);
  if (maxPrice) params.set('maxPrice', maxPrice);
  if (searchKeyword) params.set('searchKeyword', searchKeyword);
  if (inStock) params.set('inStock', '1');

  const { success, data, message }: ResponseApi<ProductFilterOptions> = await (
    await fetch(`${BASE_URL}/api/product/filters?${params}`)
  ).json();
  if (!success || data == null) {
    throw new Error(message || 'Failed to fetch product filter options');
  }
  return data;
};
