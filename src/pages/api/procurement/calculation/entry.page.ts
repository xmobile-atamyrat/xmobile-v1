import dbClient from '@/lib/dbClient';
import addCors from '@/pages/api/utils/addCors';
import withAuth, {
  AuthenticatedRequest,
} from '@/pages/api/utils/authMiddleware';
import { CalculationEntry } from '@prisma/client';
import { NextApiRequest, NextApiResponse } from 'next';

const filepath = 'src/pages/api/procurement/calculation/entry.page.ts';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  addCors(res);
  const { userId, method } = req as AuthenticatedRequest;
  const user = await dbClient.user.findUnique({
    where: { id: userId },
  });
  if (!user || user.grade !== 'SUPERUSER') {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    if (method === 'GET') {
      const id = req.query.id as string;
      const entry = await dbClient.calculationEntry.findUnique({
        where: { id },
      });
      return res.status(200).json({ success: true, data: entry });
    }
    if (method === 'POST') {
      const {
        calculationId,
        price,
        procurementProductId,
        supplierId,
      }: CalculationEntry = req.body;

      const entry = await dbClient.calculationEntry.create({
        data: {
          calculationId,
          price,
          procurementProductId,
          supplierId,
        },
      });
      return res.status(200).json({ success: true, data: entry });
    }
    if (method === 'PUT') {
      const {
        id,
        calculationId,
        price,
        procurementProductId,
        supplierId,
      }: CalculationEntry = req.body;

      const updateData: any = {};
      if (calculationId) updateData.calculationId = calculationId;
      if (price) updateData.price = price;
      if (procurementProductId)
        updateData.procurementProductId = procurementProductId;
      if (supplierId) updateData.supplierId = supplierId;

      const entry = await dbClient.calculationEntry.update({
        where: { id },
        data: updateData,
      });
      return res.status(200).json({ success: true, data: entry });
    }
    if (method === 'DELETE') {
      const id = req.query.id as string;
      const entry = await dbClient.calculationEntry.delete({
        where: { id },
      });
      return res.status(200).json({ success: true, data: entry });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message,
    });
  }

  console.error(`${filepath}: Method not allowed`);
  return res
    .status(405)
    .json({ success: false, message: 'Method not allowed' });
}

export default withAuth(handler);
