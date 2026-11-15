import dbClient from '@/lib/dbClient';
import { buildProductWhere } from '@/pages/api/product/productWhere';

export type HomeBrand = { id: string; name: string };

/**
 * Brands with at least one product the brand's chip can show (listable and in
 * stock, as the product API's `inStock=1` sees it), in the admin-chosen order.
 */
export async function getHomeBrands(): Promise<HomeBrand[]> {
  const shownProduct = await buildProductWhere({ inStock: '1' });
  return dbClient.brand.findMany({
    where: { products: { some: shownProduct ?? {} } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  });
}
