import { Prisma } from '@prisma/client';

/** Use in `where` for storefront / public catalog queries. */
export const whereActiveProduct: Prisma.ProductWhereInput = { deletedAt: null };

// In-stock first. `nulls: 'first'` is required: Postgres sorts ASC as NULLS
// LAST, which would bury every available product below the sold-out ones.
export const inStockFirst = {
  outOfStockAt: { sort: 'asc', nulls: 'first' },
} satisfies Prisma.ProductOrderByWithRelationInput;

export const whereActiveCategory: Prisma.CategoryWhereInput = {
  deletedAt: null,
};

export const whereActiveBanner: Prisma.PromoBannerWhereInput = {
  deletedAt: null,
};
