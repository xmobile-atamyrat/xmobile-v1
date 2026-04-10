import { describe, expect, it } from 'vitest';

import { buildPopularCategoriesSectionModel } from '@/pages/lib/popularCategoriesLayout';
import { ExtendedCategory } from '@/pages/lib/types';

function root(
  id: string,
  partial: Partial<ExtendedCategory> & Pick<ExtendedCategory, 'popular'>,
): ExtendedCategory {
  return {
    id,
    name: `{"en":"${id}"}`,
    slug: null,
    predecessorId: null,
    sortOrder: 0,
    imgUrl: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    popular: partial.popular,
    successorCategories: partial.successorCategories,
    ...partial,
  };
}

function child(
  id: string,
  parentId: string,
  partial?: Partial<ExtendedCategory>,
): ExtendedCategory {
  return {
    id,
    name: `{"en":"${id}"}`,
    slug: null,
    predecessorId: parentId,
    sortOrder: 0,
    imgUrl: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    popular: false,
    ...partial,
  };
}

describe('buildPopularCategoriesSectionModel', () => {
  it('returns shouldRender false for empty input', () => {
    expect(buildPopularCategoriesSectionModel([])).toEqual({
      shouldRender: false,
      fullWidthItems: [],
      showFullWidthMore: false,
    });
  });

  it('ignores non-root and deleted categories', () => {
    const p = root('p', { popular: false });
    const model = buildPopularCategoriesSectionModel([
      child('c1', 'missing-parent', { popular: true }),
      {
        ...root('gone', { popular: true }),
        deletedAt: new Date(),
      },
      p,
    ]);
    expect(model.shouldRender).toBe(true);
    expect(model.fullWidthItems).toEqual([]);
    expect(model.showFullWidthMore).toBe(true);
  });

  it('places popular categories in full-width list only', () => {
    const a = root('a', { popular: true, sortOrder: 0 });
    const b = root('b', { popular: false, sortOrder: 1 });
    const model = buildPopularCategoriesSectionModel([b, a]);
    expect(model.fullWidthItems.map((c) => c.id)).toEqual(['a']);
    expect(model.showFullWidthMore).toBe(true);
  });

  it('treats undefined popular as non-popular', () => {
    const base = root('u', { popular: false });
    const r = { ...base, popular: undefined } as ExtendedCategory;
    const model = buildPopularCategoriesSectionModel([r]);
    expect(model.fullWidthItems).toEqual([]);
    expect(model.showFullWidthMore).toBe(true);
  });
});
