import {
  isValidListingRank,
  LISTING_RANK_MAX,
  listingRankChanges,
  moveKeepingRanks,
  rankForAdd,
  shiftAddedRanks,
} from '@/pages/lib/listingRank';
import { describe, expect, it } from 'vitest';

const rows = (pairs: [string, number][]) =>
  pairs.map(([id, listingRank]) => ({ id, listingRank }));

describe('moveKeepingRanks', () => {
  it('keeps the same numbers and hands them out in the new order', () => {
    const items = rows([
      ['a', 2],
      ['b', 13],
      ['c', 99],
      ['d', 123],
    ]);
    expect(moveKeepingRanks(items, 3, 0)).toEqual(
      rows([
        ['d', 2],
        ['a', 13],
        ['b', 99],
        ['c', 123],
      ]),
    );
  });

  it('moves one step down', () => {
    expect(
      moveKeepingRanks(
        rows([
          ['a', 1],
          ['b', 5],
        ]),
        0,
        1,
      ),
    ).toEqual(
      rows([
        ['b', 1],
        ['a', 5],
      ]),
    );
  });

  it('ignores a move to the same or an out-of-range index', () => {
    const items = rows([
      ['a', 1],
      ['b', 2],
    ]);
    expect(moveKeepingRanks(items, 1, 1)).toBe(items);
    expect(moveKeepingRanks(items, 0, -1)).toBe(items);
    expect(moveKeepingRanks(items, 0, 2)).toBe(items);
  });
});

describe('listingRankChanges', () => {
  it('lists changed, added and removed products only', () => {
    const saved = rows([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const current = rows([
      ['b', 1],
      ['a', 2],
      ['c', 3],
      ['d', 4],
    ]).filter(({ id }) => id !== 'c');
    expect(listingRankChanges(saved, current)).toEqual([
      { productId: 'b', listingRank: 1 },
      { productId: 'a', listingRank: 2 },
      { productId: 'd', listingRank: 4 },
      { productId: 'c', listingRank: null },
    ]);
  });

  it('is empty when nothing moved', () => {
    const saved = rows([['a', 1]]);
    expect(listingRankChanges(saved, rows([['a', 1]]))).toEqual([]);
  });
});

describe('isValidListingRank', () => {
  it('accepts whole numbers from 1 to the maximum', () => {
    expect(isValidListingRank(1)).toBe(true);
    expect(isValidListingRank(999999)).toBe(true);
    expect(isValidListingRank(0)).toBe(false);
    expect(isValidListingRank(1.5)).toBe(false);
    expect(isValidListingRank(1000000)).toBe(false);
    expect(isValidListingRank(Number.NaN)).toBe(false);
  });
});

describe('rankForAdd', () => {
  it("starts from the server's next number", () => {
    expect(rankForAdd(rows([['a', 3]]), 10)).toBe(10);
  });

  it('steps past numbers the unsaved list already uses', () => {
    expect(
      rankForAdd(
        rows([
          ['a', 10],
          ['b', 11],
          ['c', 500],
        ]),
        10,
      ),
    ).toBe(12);
  });

  it('never proposes a number past the maximum', () => {
    expect(rankForAdd(rows([['a', LISTING_RANK_MAX]]), LISTING_RANK_MAX)).toBe(
      null,
    );
    expect(rankForAdd(rows([['a', LISTING_RANK_MAX]]), 7)).toBe(7);
    expect(rankForAdd([], null)).toBe(null);
  });
});

describe('shiftAddedRanks', () => {
  const saved = new Set(['a', 'b']);

  it('moves only the products added since the save, keeping their order', () => {
    const items = rows([
      ['a', 1],
      ['b', 2],
      ['x', 10],
      ['y', 11],
    ]);
    expect(shiftAddedRanks(items, saved, 10, 14)).toEqual(
      rows([
        ['a', 1],
        ['b', 2],
        ['x', 14],
        ['y', 15],
      ]),
    );
  });

  it('leaves an added product with a typed lower number alone', () => {
    const items = rows([
      ['a', 1],
      ['x', 5],
      ['y', 10],
    ]);
    expect(shiftAddedRanks(items, saved, 10, 12)).toEqual(
      rows([
        ['a', 1],
        ['x', 5],
        ['y', 12],
      ]),
    );
  });

  it('gives up when nothing moves, it would collide, or it runs past the maximum', () => {
    const items = rows([
      ['a', 1],
      ['x', 10],
    ]);
    expect(shiftAddedRanks(items, saved, 10, 10)).toBeNull();
    expect(shiftAddedRanks(rows([['a', 1]]), saved, 10, 12)).toBeNull();
    expect(
      shiftAddedRanks(
        rows([
          ['a', 12],
          ['x', 10],
        ]),
        saved,
        10,
        12,
      ),
    ).toBeNull();
    expect(shiftAddedRanks(items, saved, 10, LISTING_RANK_MAX + 1)).toBeNull();
  });
});
