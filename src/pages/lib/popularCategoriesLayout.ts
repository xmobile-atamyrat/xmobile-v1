import { ExtendedCategory } from '@/pages/lib/types';

export const POPULAR_CATEGORIES_SECTION_MAX = 7;

/** API returns this in `message` when enabling popular would exceed {@link POPULAR_CATEGORIES_SECTION_MAX} root popular categories. */
export const POPULAR_ROOT_LIMIT_CODE = 'POPULAR_ROOT_LIMIT';

export const HOME_CATEGORY_GRID_SIZE = 6;

export type PopularCategoriesSectionModel = {
  shouldRender: boolean;
  primary: ExtendedCategory[];
  rest: ExtendedCategory[];
};

export function buildPopularCategoriesSectionModel(
  categories: ExtendedCategory[],
): PopularCategoriesSectionModel {
  const topLevel = categories.filter(
    (cat) => cat.predecessorId == null && cat.deletedAt == null,
  );

  const ordered = [
    ...topLevel.filter((cat) => cat.popular),
    ...topLevel.filter((cat) => !cat.popular),
  ];

  return {
    shouldRender: topLevel.length > 0,
    primary: ordered.slice(0, HOME_CATEGORY_GRID_SIZE),
    rest: ordered.slice(HOME_CATEGORY_GRID_SIZE),
  };
}
