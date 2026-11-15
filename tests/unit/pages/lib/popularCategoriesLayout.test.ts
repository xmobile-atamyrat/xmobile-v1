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

const ids = (list: ExtendedCategory[]) => list.map((c) => c.id);

describe('buildPopularCategoriesSectionModel', () => {
  it('returns shouldRender false for empty input', () => {
    expect(buildPopularCategoriesSectionModel([])).toEqual({
      shouldRender: false,
      primary: [],
      rest: [],
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
    expect(ids(model.primary)).toEqual(['p']);
    expect(model.rest).toEqual([]);
  });

  it('puts the first 6 popular in primary and the remainder in rest', () => {
    const popular = Array.from({ length: 7 }, (_, i) =>
      root(`pop${i + 1}`, { popular: true }),
    );
    const o1 = root('o1', { popular: false });
    const o2 = root('o2', { popular: false });
    const model = buildPopularCategoriesSectionModel([o1, ...popular, o2]);
    expect(ids(model.primary)).toEqual([
      'pop1',
      'pop2',
      'pop3',
      'pop4',
      'pop5',
      'pop6',
    ]);
    expect(ids(model.rest)).toEqual(['pop7', 'o1', 'o2']);
  });

  it('fills primary with non-popular after the popular ones', () => {
    const popular = [
      root('pop1', { popular: true }),
      root('pop2', { popular: true }),
    ];
    const others = Array.from({ length: 5 }, (_, i) =>
      root(`o${i + 1}`, { popular: false }),
    );
    const model = buildPopularCategoriesSectionModel([...others, ...popular]);
    expect(ids(model.primary)).toEqual([
      'pop1',
      'pop2',
      'o1',
      'o2',
      'o3',
      'o4',
    ]);
    expect(ids(model.rest)).toEqual(['o5']);
  });

  it('uses non-popular roots alone when none are popular', () => {
    const others = ['o1', 'o2', 'o3'].map((id) => root(id, { popular: false }));
    const model = buildPopularCategoriesSectionModel(others);
    expect(ids(model.primary)).toEqual(['o1', 'o2', 'o3']);
    expect(model.rest).toEqual([]);
  });

  it('treats undefined popular as non-popular', () => {
    const base = root('u', { popular: false });
    const r = { ...base, popular: undefined } as ExtendedCategory;
    const model = buildPopularCategoriesSectionModel([r]);
    expect(ids(model.primary)).toEqual(['u']);
    expect(model.rest).toEqual([]);
  });
});
