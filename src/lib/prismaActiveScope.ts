import { Prisma } from '@prisma/client';

/** Use in `where` for storefront / public catalog queries. */
export const whereActiveProduct: Prisma.ProductWhereInput = { deletedAt: null };

export const whereActiveCategory: Prisma.CategoryWhereInput = {
  deletedAt: null,
};
