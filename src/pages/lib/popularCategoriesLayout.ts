import { ExtendedCategory } from '@/pages/lib/types';

export const POPULAR_CATEGORIES_SECTION_MAX = 7;

/** API returns this in `message` when enabling popular would exceed {@link POPULAR_CATEGORIES_SECTION_MAX} root popular categories. */
export const POPULAR_ROOT_LIMIT_CODE = 'POPULAR_ROOT_LIMIT';

export type PopularHalfPair = {
  left: ExtendedCategory;
  right: ExtendedCategory | 'more';
};

export type PopularCategoriesSectionModel = {
  shouldRender: boolean;
  fullWidthItems: ExtendedCategory[];
  /** Full-width "More" row after the last popular card when there are 7+ popular roots. */
  showFullWidthMore: boolean;
  halfPairs: PopularHalfPair[];
};

/**
 * Layout rules for the home "Popular categories" section: top-level, non-deleted
 * categories only; popular first; cap at {@link POPULAR_CATEGORIES_SECTION_MAX};
 * full-width rows for popular; half-width grid for non-popular with a trailing "more" tile.
 * When there are at least {@link POPULAR_CATEGORIES_SECTION_MAX} popular roots, the section
 * shows that many popular cards plus a full-width "More" row (8 rows total).
 */
export function buildPopularCategoriesSectionModel(
  categories: ExtendedCategory[],
): PopularCategoriesSectionModel {
  const empty: PopularCategoriesSectionModel = {
    shouldRender: false,
    fullWidthItems: [],
    showFullWidthMore: false,
    halfPairs: [],
  };

  const topLevel = categories.filter(
    (cat) => cat.predecessorId == null && cat.deletedAt == null,
  );

  const popularOnes = topLevel.filter((cat) => cat.popular);
  const regularOnes = topLevel.filter((cat) => !cat.popular);

  if (popularOnes.length >= POPULAR_CATEGORIES_SECTION_MAX) {
    const fullWidthItems = popularOnes.slice(0, POPULAR_CATEGORIES_SECTION_MAX);
    return {
      shouldRender: true,
      fullWidthItems,
      showFullWidthMore: true,
      halfPairs: [],
    };
  }

  const displayCats = [...popularOnes, ...regularOnes].slice(
    0,
    POPULAR_CATEGORIES_SECTION_MAX,
  );

  if (displayCats.length === 0) {
    return empty;
  }

  const fullWidthItems = displayCats.filter((cat) => cat.popular);
  const halfWidthItems = displayCats.filter((cat) => !cat.popular);

  const usedHalfWidthItems =
    halfWidthItems.length > 0 && halfWidthItems.length % 2 === 0
      ? halfWidthItems.slice(0, halfWidthItems.length - 1)
      : halfWidthItems;

  const halfPairs: PopularHalfPair[] = [];
  for (let i = 0; i + 1 < usedHalfWidthItems.length; i += 2) {
    halfPairs.push({
      left: usedHalfWidthItems[i],
      right: usedHalfWidthItems[i + 1],
    });
  }
  if (usedHalfWidthItems.length > 0) {
    halfPairs.push({
      left: usedHalfWidthItems[usedHalfWidthItems.length - 1],
      right: 'more',
    });
  }

  return {
    shouldRender: true,
    fullWidthItems,
    showFullWidthMore: false,
    halfPairs,
  };
}
