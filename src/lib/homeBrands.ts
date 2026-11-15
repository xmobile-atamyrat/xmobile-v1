import dbClient from '@/lib/dbClient';
import { buildProductWhere } from '@/pages/api/product/productWhere';
import { HOME_BRAND_MIN_PRODUCTS } from '@/pages/lib/constants';

export type HomeBrand = { id: string; name: string };

/**
 * Brands with enough products for their chip to be worth a tap (listable and
 * in stock, as the product API's `inStock=1` sees it), in the admin-chosen
 * order.
 */
export async function getHomeBrands(): Promise<HomeBrand[]> {
  const shownProduct = (await buildProductWhere({ inStock: '1' })) ?? {};
  const brands = await dbClient.brand.findMany({
    where: { products: { some: shownProduct } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      _count: { select: { products: { where: shownProduct } } },
    },
  });
  return (
    brands
      // _count is Prisma's own relation-count shape, not our naming.
      // eslint-disable-next-line no-underscore-dangle
      .filter((brand) => brand._count.products >= HOME_BRAND_MIN_PRODUCTS)
      .map(({ id, name }) => ({ id, name }))
  );
}
