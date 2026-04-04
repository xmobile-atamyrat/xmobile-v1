import { describe, expect, it } from 'vitest';

import {
  whereActiveCategory,
  whereActiveProduct,
} from '@/lib/prismaActiveScope';

describe('prismaActiveScope', () => {
  it('restricts products to non–soft-deleted rows', () => {
    expect(whereActiveProduct).toEqual({ deletedAt: null });
  });

  it('restricts categories to non–soft-deleted rows', () => {
    expect(whereActiveCategory).toEqual({ deletedAt: null });
  });
});
