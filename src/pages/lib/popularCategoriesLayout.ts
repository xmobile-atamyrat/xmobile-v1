import { ExtendedCategory } from '@/pages/lib/types';

export const POPULAR_CATEGORIES_SECTION_MAX = 7;

/** API returns this in `message` when enabling popular would exceed {@link POPULAR_CATEGORIES_SECTION_MAX} root popular categories. */
export const POPULAR_ROOT_LIMIT_CODE = 'POPULAR_ROOT_LIMIT';

export type PopularCategoriesSectionModel = {
  shouldRender: boolean;
  fullWidthItems: ExtendedCategory[];
  /** Full-width "More" row after the last popular card. */
  showFullWidthMore: boolean;
};

export function buildPopularCategoriesSectionModel(
  categories: ExtendedCategory[],
): PopularCategoriesSectionModel {
  const topLevel = categories.filter(
    (cat) => cat.predecessorId == null && cat.deletedAt == null,
  );

  if (topLevel.length === 0) {
    return {
      shouldRender: false,
      fullWidthItems: [],
      showFullWidthMore: false,
    };
  }

  const fullWidthItems = topLevel.filter((cat) => cat.popular);

  return {
    shouldRender: true,
    fullWidthItems,
    showFullWidthMore: true,
  };
}
