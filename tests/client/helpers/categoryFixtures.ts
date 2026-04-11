import type { ExtendedCategory } from '@/pages/lib/types';

export function rootPopularCategory(
  overrides: Partial<ExtendedCategory> = {},
): ExtendedCategory {
  return {
    id: 'cat-root-1',
    slug: 'electronics',
    name: JSON.stringify({ tk: 'Elektronika', en: 'Electronics' }),
    predecessorId: null,
    deletedAt: null,
    popular: true,
    imgUrl: 'https://example.com/image.png',
    successorCategories: [],
    ...overrides,
  } as ExtendedCategory;
}

export function childCategory(
  overrides: Partial<ExtendedCategory> = {},
): ExtendedCategory {
  return {
    id: 'cat-child-1',
    slug: 'phones',
    name: JSON.stringify({ tk: 'Telefonlar', en: 'Phones' }),
    predecessorId: 'parent',
    deletedAt: null,
    popular: false,
    imgUrl: null,
    successorCategories: [],
    ...overrides,
  } as ExtendedCategory;
}
