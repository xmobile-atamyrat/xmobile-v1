import { describe, expect, it } from 'vitest';

import type { ExtendedCategory } from '@/pages/lib/types';
import {
  buildCategoryPath,
  findCategory,
  findParentCategory,
} from '@/pages/lib/categoryPathUtils';

function cat(
  id: string,
  successors: ExtendedCategory[] = [],
): ExtendedCategory {
  return {
    id,
    successorCategories: successors,
  } as ExtendedCategory;
}

describe('findCategory', () => {
  it('returns a direct match at the top level', () => {
    const tree = [cat('a'), cat('b')];
    expect(findCategory(tree, 'b')?.id).toBe('b');
  });

  it('finds a nested category', () => {
    const tree = [cat('root', [cat('child', [cat('leaf')])])];
    expect(findCategory(tree, 'leaf')?.id).toBe('leaf');
  });

  it('returns null when not found', () => {
    expect(findCategory([cat('only')], 'missing')).toBeNull();
  });
});

describe('findParentCategory', () => {
  it('returns the parent of a direct child', () => {
    const tree = [cat('parent', [cat('kid')])];
    expect(findParentCategory('kid', tree)?.id).toBe('parent');
  });

  it('returns null for a root id', () => {
    const tree = [cat('root', [cat('kid')])];
    expect(findParentCategory('root', tree)).toBeNull();
  });
});

describe('buildCategoryPath', () => {
  it('returns root-to-leaf order', () => {
    const leaf = cat('leaf');
    const mid = cat('mid', [leaf]);
    const root = cat('root', [mid]);
    const path = buildCategoryPath('leaf', [root]);

    expect(path.map((c) => c.id)).toEqual(['root', 'mid', 'leaf']);
  });

  it('returns a single node for a root category', () => {
    const root = cat('solo');
    expect(buildCategoryPath('solo', [root]).map((c) => c.id)).toEqual([
      'solo',
    ]);
  });
});
