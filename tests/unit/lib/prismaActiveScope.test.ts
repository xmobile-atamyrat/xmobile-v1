import { describe, expect, it } from 'vitest';

import {
  whereActiveBanner,
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

  it('restricts banners to non–soft-deleted rows', () => {
    expect(whereActiveBanner).toEqual({ deletedAt: null });
  });
});
