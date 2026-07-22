import {
  getListSnapshot,
  setListSnapshot,
  type ListSnapshot,
} from '@/pages/lib/listRestoration';
import type { Product } from '@prisma/client';
import { describe, expect, it } from 'vitest';

const snap = (page: number): ListSnapshot => ({
  products: [{ id: `p${page}` } as Product],
  page,
  hasMore: true,
  scrollY: page * 100,
});

describe('listRestoration cache', () => {
  it('stores and returns a snapshot by key', () => {
    setListSnapshot('/product?brandIds=a', snap(3));
    expect(getListSnapshot('/product?brandIds=a')).toEqual(snap(3));
  });

  it('isolates entries per filter query string', () => {
    setListSnapshot('/product?brandIds=a', snap(3));
    setListSnapshot('/product?brandIds=b', snap(1));
    expect(getListSnapshot('/product?brandIds=a')?.page).toBe(3);
    expect(getListSnapshot('/product?brandIds=b')?.page).toBe(1);
  });

  it('returns undefined for an unknown key', () => {
    expect(getListSnapshot('/never-visited')).toBeUndefined();
  });
});
