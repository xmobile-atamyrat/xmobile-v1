import dbClient from '@/lib/dbClient';
import { whereActiveProduct } from '@/lib/prismaActiveScope';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { ResponseApi } from '@/pages/lib/types';
import { collectBrandPriceIds } from '@/pages/product/price-list/brandPrices';
import { UserRole } from '@prisma/client';
import type { NextApiResponse } from 'next';

const filepath = 'src/pages/api/prices/brands.page.ts';

// Returns a map of brandId -> priceIds the brand's products reference. Prices
// carry no brand link; the relationship is implicit in each product's `price`
// ([priceId]) and its `tags` (each "spec [priceId]{colorId}"). The price-list
// page uses this to export prices by brand. Sibling of prices/categories.page.ts,
// which derives the same relationship for categories.
async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  if (req.grade !== UserRole.ADMIN && req.grade !== UserRole.SUPERUSER) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const products = await dbClient.product.findMany({
      where: { ...whereActiveProduct, brandId: { not: null } },
      select: { brandId: true, price: true, tags: true },
    });

    return res
      .status(200)
      .json({ success: true, data: collectBrandPriceIds(products) });
  } catch (error) {
    console.error(filepath, error);
    return res
      .status(500)
      .json({ success: false, message: (error as Error).message });
  }
}

export default withAuth(handler);
