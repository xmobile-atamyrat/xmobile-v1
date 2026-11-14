import { categorySiblingOrderBy } from '@/lib/categoryHierarchy';
import dbClient from '@/lib/dbClient';
import {
  whereActiveProduct,
  whereListableProduct,
} from '@/lib/prismaActiveScope';
import { productSearchWhere } from '@/lib/productSearchWhere';
import { colorFamilyOf, isColorFamily } from '@/pages/lib/colorFamilies';
import { Prisma } from '@prisma/client';

type QueryValue = string | string[] | undefined;

/** The storefront filter params shared by the product list and its facets. */
export interface ProductFilterQuery {
  searchKeyword?: string;
  categoryId?: QueryValue;
  categoryIds?: QueryValue;
  brandIds?: QueryValue;
  colorIds?: QueryValue;
  colors?: QueryValue;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  recommended?: string;
  /** '1': only products without images. Staff only, see buildProductWhere. */
  imageless?: string;
}

export function toArray(value?: QueryValue): string[] | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value : [value];
}

async function getRecursiveCategoryIds(
  rootId: string,
  visited: Set<string> = new Set(),
): Promise<string[]> {
  if (visited.has(rootId)) return [];
  visited.add(rootId);

  const category = await dbClient.category.findFirst({
    where: { id: rootId, deletedAt: null },
    include: {
      successorCategories: {
        where: { deletedAt: null },
        orderBy: categorySiblingOrderBy,
      },
    },
  });
  if (!category) return [];
  const ids = [rootId];
  if (category.successorCategories) {
    const nestedIds = await Promise.all(
      category.successorCategories.map((sub) =>
        getRecursiveCategoryIds(sub.id, visited),
      ),
    );
    ids.push(...nestedIds.flat());
  }
  return ids;
}

export interface ProductWhereOptions {
  /**
   * Also match products without images. Only for staff: shoppers never see
   * them as cards, but an admin has to find one to give it a photo.
   */
  includeImageless?: boolean;
}

/**
 * Builds the Prisma filter for a storefront query. Returns null when the
 * query can match nothing (its categories no longer exist).
 */
export async function buildProductWhere(
  query: ProductFilterQuery,
  { includeImageless = false }: ProductWhereOptions = {},
): Promise<Prisma.ProductWhereInput | null> {
  const {
    searchKeyword,
    categoryId,
    categoryIds,
    brandIds,
    colorIds,
    colors,
    minPrice,
    maxPrice,
    inStock,
    recommended,
    imageless,
  } = query;
  // Asked for by staff only (home's "without photos" section). Anyone else
  // gets nothing rather than a hint of which products those are.
  if (imageless === '1' && !includeImageless) return null;
  const where: Prisma.ProductWhereInput = includeImageless
    ? { ...whereActiveProduct }
    : { ...whereListableProduct };

  const categories = [
    ...(toArray(categoryId) ?? []),
    ...(toArray(categoryIds) ?? []),
  ];
  if (categories.length > 0) {
    const recursiveIds = await Promise.all(
      categories.map((catId) => getRecursiveCategoryIds(catId)),
    );
    const uniqueIds = [...new Set(recursiveIds.flat())];
    if (uniqueIds.length === 0) return null;
    where.categoryId = { in: uniqueIds };
  }

  if (brandIds) {
    where.brandId = { in: toArray(brandIds) };
  }

  // Color filter (OR within the dimension). The storefront sends family names
  // (`colors=black`) so its URLs stay short; they resolve to every colour row
  // in that family here.
  const families = toArray(colors)?.filter(isColorFamily);
  const familyColorIds = families?.length
    ? (
        await dbClient.color.findMany({
          select: { id: true, name: true, hex: true },
        })
      )
        .filter((color) => families.includes(colorFamilyOf(color)))
        .map((color) => color.id)
    : undefined;
  const colorFilter =
    familyColorIds || colorIds
      ? [...(familyColorIds ?? []), ...(toArray(colorIds) ?? [])]
      : undefined;
  if (colorFilter) where.colors = { some: { id: { in: colorFilter } } };

  if (searchKeyword) {
    where.AND = productSearchWhere(searchKeyword);
  }

  if (imageless === '1') {
    where.imgUrls = { isEmpty: true };
  }

  if (inStock === '1') {
    where.outOfStockAt = null;
  }

  // '0' is home's newest row, which leaves the picks to the recommended row
  // so a product never shows twice there.
  if (recommended === '1') {
    where.recommendedOrder = { not: null };
  } else if (recommended === '0') {
    where.recommendedOrder = null;
  }

  // Both bounds and cachedPrice are the shown manat, so they compare directly.
  const minTmt = minPrice ? parseFloat(minPrice) : NaN;
  const maxTmt = maxPrice ? parseFloat(maxPrice) : NaN;
  if (!Number.isNaN(minTmt) || !Number.isNaN(maxTmt)) {
    where.cachedPrice = {
      ...(Number.isNaN(minTmt) ? {} : { gte: minTmt }),
      ...(Number.isNaN(maxTmt) ? {} : { lte: maxTmt }),
    };
  }

  return where;
}
