import { describe, expect, it } from 'vitest';

import {
  POPULAR_CATEGORIES_SECTION_MAX,
  buildPopularCategoriesSectionModel,
} from '@/pages/lib/popularCategoriesLayout';
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
      halfPairs: [],
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
    expect(model.halfPairs.map((h) => h.left.id)).toEqual(['p']);
  });

  it('orders popular roots before non-popular (stable within each group)', () => {
    const np = root('np', { popular: false, sortOrder: 0 });
    const p1 = root('p1', { popular: true, sortOrder: 1 });
    const p2 = root('p2', { popular: true, sortOrder: 2 });
    const model = buildPopularCategoriesSectionModel([np, p1, p2]);
    expect(model.fullWidthItems.map((c) => c.id)).toEqual(['p1', 'p2']);
    expect(model.halfPairs).toEqual([{ left: np, right: 'more' }]);
  });

  it('does not include categories beyond the max in the layout', () => {
    const cats = Array.from(
      { length: POPULAR_CATEGORIES_SECTION_MAX + 1 },
      (_, i) => root(`x${i}`, { popular: false, sortOrder: i }),
    );
    const model = buildPopularCategoriesSectionModel(cats);
    const ids = new Set<string>();
    model.fullWidthItems.forEach((c) => ids.add(c.id));
    model.halfPairs.forEach((p) => {
      ids.add(p.left.id);
      if (p.right !== 'more') ids.add(p.right.id);
    });
    expect(ids.has(`x${POPULAR_CATEGORIES_SECTION_MAX}`)).toBe(false);
  });

  it('places popular categories in full-width list only', () => {
    const a = root('a', { popular: true, sortOrder: 0 });
    const b = root('b', { popular: false, sortOrder: 1 });
    const model = buildPopularCategoriesSectionModel([b, a]);
    expect(model.fullWidthItems.map((c) => c.id)).toEqual(['a']);
    expect(model.halfPairs.some((p) => p.left.id === 'a')).toBe(false);
  });

  it('pairs non-popular halves and ends with a more tile (single)', () => {
    const a = root('a', { popular: false });
    const model = buildPopularCategoriesSectionModel([a]);
    expect(model.fullWidthItems).toEqual([]);
    expect(model.halfPairs).toEqual([{ left: a, right: 'more' }]);
  });

  it('drops the last non-popular when there are exactly two (even half-width count)', () => {
    const a = root('a', { popular: false, sortOrder: 0 });
    const b = root('b', { popular: false, sortOrder: 1 });
    const model = buildPopularCategoriesSectionModel([a, b]);
    expect(model.halfPairs).toEqual([{ left: a, right: 'more' }]);
  });

  it('drops last non-popular when count is even to keep grid + more consistent', () => {
    const cats = ['a', 'b', 'c', 'd'].map((id, i) =>
      root(id, { popular: false, sortOrder: i }),
    );
    const model = buildPopularCategoriesSectionModel(cats);
    expect(model.fullWidthItems).toEqual([]);
    expect(model.halfPairs.map((p) => p.left.id)).toEqual(['a', 'c']);
    expect(model.halfPairs[0].right).not.toBe('more');
    expect(model.halfPairs[1]).toEqual({ left: cats[2], right: 'more' });
  });

  it('uses three non-popular without dropping when length is odd', () => {
    const a = root('a', { popular: false, sortOrder: 0 });
    const b = root('b', { popular: false, sortOrder: 1 });
    const c = root('c', { popular: false, sortOrder: 2 });
    const model = buildPopularCategoriesSectionModel([a, b, c]);
    expect(model.halfPairs).toEqual([
      { left: a, right: b },
      { left: c, right: 'more' },
    ]);
  });

  it('treats undefined popular as non-popular', () => {
    const base = root('u', { popular: false });
    const r = { ...base, popular: undefined } as ExtendedCategory;
    const model = buildPopularCategoriesSectionModel([r]);
    expect(model.fullWidthItems).toEqual([]);
    expect(model.halfPairs).toEqual([{ left: r, right: 'more' }]);
  });

  it('shows full-width more when there are at least 7 popular roots', () => {
    const cats = Array.from({ length: 7 }, (_, i) =>
      root(`p${i}`, { popular: true, sortOrder: i }),
    );
    const model = buildPopularCategoriesSectionModel(cats);
    expect(model.shouldRender).toBe(true);
    expect(model.fullWidthItems).toHaveLength(7);
    expect(model.showFullWidthMore).toBe(true);
    expect(model.halfPairs).toEqual([]);
  });

  it('caps popular cards at 7 and still shows full-width more when more than 7 popular exist', () => {
    const cats = Array.from({ length: 10 }, (_, i) =>
      root(`p${i}`, { popular: true, sortOrder: i }),
    );
    const model = buildPopularCategoriesSectionModel(cats);
    expect(model.fullWidthItems.map((c) => c.id)).toEqual([
      'p0',
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
    ]);
    expect(model.showFullWidthMore).toBe(true);
    expect(model.halfPairs).toEqual([]);
  });

  it('does not show full-width more when there are fewer than 7 popular roots', () => {
    const cats = Array.from({ length: 6 }, (_, i) =>
      root(`p${i}`, { popular: true, sortOrder: i }),
    );
    const model = buildPopularCategoriesSectionModel(cats);
    expect(model.fullWidthItems).toHaveLength(6);
    expect(model.showFullWidthMore).toBe(false);
  });
});
