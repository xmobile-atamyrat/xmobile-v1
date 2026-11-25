import dbClient from '@/lib/dbClient';
import { getStaleProducts } from '@/lib/priceStalenessQueries';
import addCors from '@/pages/api/utils/addCors';
import { requireStaffBearerAuth } from '@/pages/api/utils/staffAuth';
import { ResponseApi } from '@/pages/lib/types';
import type { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/prices/stale.page.ts';

// Staff-only: the stale products, keyed by product id. The storefront pages
// are pre-built and shared by every visitor, so an admin's browser asks for
// this once and the product cards and red dots read from the answer.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi>,
) {
  addCors(res);
  if (req.method !== 'GET') {
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }
  if (!(await requireStaffBearerAuth(req, res))) return undefined;

  try {
    const data = await getStaleProducts(dbClient);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error(filepath, error);
    return res
      .status(500)
      .json({ success: false, message: (error as Error).message });
  }
}
