import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/dbClient', () => ({
  default: {
    category: {
      findFirst: vi.fn(),
    },
  },
}));

import dbClient from '@/lib/dbClient';
import {
  categorySiblingOrderBy,
  collectActiveSubtreeCategoryIds,
  nextSiblingSortOrder,
} from '@/lib/categoryHierarchy';

describe('categorySiblingOrderBy', () => {
  it('orders by sortOrder then createdAt ascending', () => {
    expect(categorySiblingOrderBy).toEqual([
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ]);
  });
});

describe('nextSiblingSortOrder', () => {
  beforeEach(() => {
    vi.mocked(dbClient.category.findFirst).mockReset();
  });

  it('returns 0 when no sibling exists', async () => {
    vi.mocked(dbClient.category.findFirst).mockResolvedValue(null);
    await expect(nextSiblingSortOrder(null)).resolves.toBe(0);
    expect(dbClient.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { predecessorId: null, deletedAt: null },
        orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
        select: { sortOrder: true },
      }),
    );
  });

  it('returns max sortOrder + 1', async () => {
    vi.mocked(dbClient.category.findFirst).mockResolvedValue({
      sortOrder: 5,
    } as never);
    await expect(nextSiblingSortOrder('parent-id')).resolves.toBe(6);
    expect(dbClient.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { predecessorId: 'parent-id', deletedAt: null },
      }),
    );
  });

  it('treats sortOrder 0 as preceding 1', async () => {
    vi.mocked(dbClient.category.findFirst).mockResolvedValue({
      sortOrder: 0,
    } as never);
    await expect(nextSiblingSortOrder(null)).resolves.toBe(1);
  });
});

describe('collectActiveSubtreeCategoryIds', () => {
  beforeEach(() => {
    vi.mocked(dbClient.category.findFirst).mockReset();
  });

  it('returns empty array when root is missing', async () => {
    vi.mocked(dbClient.category.findFirst).mockResolvedValue(null);
    await expect(collectActiveSubtreeCategoryIds('missing')).resolves.toEqual(
      [],
    );
  });

  it('returns root only when there are no children', async () => {
    vi.mocked(dbClient.category.findFirst).mockResolvedValue({
      id: 'solo',
      successorCategories: [],
    } as never);
    await expect(collectActiveSubtreeCategoryIds('solo')).resolves.toEqual([
      'solo',
    ]);
  });

  it('returns root and nested descendants (sibling subtrees concatenated)', async () => {
    vi.mocked(dbClient.category.findFirst).mockImplementation((async (args: {
      where: { id: string };
    }) => {
      const id = args.where.id;
      if (id === 'root') {
        return {
          id: 'root',
          successorCategories: [{ id: 'a' }, { id: 'b' }],
        };
      }
      if (id === 'a') {
        return {
          id: 'a',
          successorCategories: [{ id: 'a1' }],
        };
      }
      if (id === 'a1' || id === 'b') {
        return { id, successorCategories: [] };
      }
      return null;
    }) as unknown as typeof dbClient.category.findFirst);

    await expect(collectActiveSubtreeCategoryIds('root')).resolves.toEqual([
      'root',
      'a',
      'a1',
      'b',
    ]);
  });
});
