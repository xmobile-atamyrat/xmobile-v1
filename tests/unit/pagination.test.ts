import {
  buildPaginationItems,
  getTotalPages,
  PAGINATION_ELLIPSIS,
} from '@/pages/lib/pagination';
import { describe, expect, it } from 'vitest';

describe('getTotalPages', () => {
  it('rounds a partial last page up', () => {
    expect(getTotalPages(41, 20)).toBe(3);
    expect(getTotalPages(40, 20)).toBe(2);
  });

  it('returns 0 when there is nothing to page', () => {
    expect(getTotalPages(0, 20)).toBe(0);
  });
});

describe('buildPaginationItems', () => {
  it('renders nothing for a single page', () => {
    expect(buildPaginationItems(1, 1)).toEqual([]);
    expect(buildPaginationItems(1, 0)).toEqual([]);
  });

  it('lists every page when they all fit without a gap', () => {
    expect(buildPaginationItems(1, 4)).toEqual([1, 2, 3, 4]);
  });

  it('matches the design: first page of a long list', () => {
    // XMobile.dc.html:1473 — `1 2 3 … 12`
    expect(buildPaginationItems(1, 12)).toEqual([
      1,
      2,
      PAGINATION_ELLIPSIS,
      12,
    ]);
  });

  it('brackets the current page in the middle of a long list', () => {
    expect(buildPaginationItems(6, 12)).toEqual([
      1,
      PAGINATION_ELLIPSIS,
      5,
      6,
      7,
      PAGINATION_ELLIPSIS,
      12,
    ]);
  });

  it('fills a single-page gap instead of an ellipsis', () => {
    expect(buildPaginationItems(4, 6)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('clamps an out-of-range current page', () => {
    expect(buildPaginationItems(99, 5)).toEqual(buildPaginationItems(5, 5));
    expect(buildPaginationItems(0, 5)).toEqual(buildPaginationItems(1, 5));
  });

  it('never repeats a page number', () => {
    const items = buildPaginationItems(2, 12);
    const numbers = items.filter((i): i is number => typeof i === 'number');
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});
