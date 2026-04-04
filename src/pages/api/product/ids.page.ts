import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import { ResponseApi } from '@/pages/lib/types';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/product/ids.page.ts';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseApi<string[]>>,
) {
  addCors(res);

  if (req.method !== 'GET') {
    console.error(`${filepath}: Method not allowed`);
    return res
      .status(405)
      .json({ success: false, message: 'Method not allowed' });
  }

  try {
    const rows = await dbClient.product.findMany({
      where: { deletedAt: null },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    const ids = rows.map((r) => r.id);
    return res.status(200).json({ success: true, data: ids });
  } catch (error) {
    console.error(filepath, 'Error listing product ids:', error);
    return res.status(500).json({
      success: false,
      message: "Couldn't list product ids",
    });
  }
}
